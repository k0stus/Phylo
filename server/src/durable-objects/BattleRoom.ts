import type { ServerMessage, ClientMessage, PublicProfile, BattleResult, CategoryScores } from '../types';

type RoomState =
  | 'waiting_for_opponent'
  | 'both_connected'
  | 'countdown'
  | 'capturing'
  | 'analyzing'
  | 'revealing_results'
  | 'complete';

interface Participant {
  ws: WebSocket;
  userId: string;
  username: string;
  profile: PublicProfile;
  ready: boolean;
  scanId: string | null;
  result: BattleResult | null;
}

export class BattleRoom {
  private state: DurableObjectState;
  private env: {
    DB: D1Database;
    ANTHROPIC_API_KEY: string;
  };

  private roomState: RoomState = 'waiting_for_opponent';
  private participants: Map<string, Participant> = new Map(); // userId -> Participant
  private battleId: string | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(state: DurableObjectState, env: { DB: D1Database; ANTHROPIC_API_KEY: string }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const battleId = url.searchParams.get('battleId');
    const userId   = url.searchParams.get('userId');
    const username = url.searchParams.get('username');
    const country  = url.searchParams.get('country');
    const wins     = parseInt(url.searchParams.get('wins') ?? '0', 10);
    const losses   = parseInt(url.searchParams.get('losses') ?? '0', 10);

    if (!battleId || !userId || !username) {
      return new Response('Missing battleId, userId, or username', { status: 400 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    if (this.participants.size >= 2) {
      return new Response('Room is full', { status: 409 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);

    const profile: PublicProfile = { id: userId, username, country: country || null, wins, losses };
    const participant: Participant = {
      ws: server,
      userId,
      username,
      profile,
      ready: false,
      scanId: null,
      result: null,
    };

    this.battleId = battleId;
    this.participants.set(userId, participant);

    if (this.participants.size === 1) {
      this.send(server, { type: 'waiting_for_opponent' });
    } else {
      // Both connected
      this.roomState = 'both_connected';
      this.broadcast({ type: 'opponent_joined', opponent: profile });
      // Also send each participant the other's profile
      for (const [uid, p] of this.participants) {
        if (uid !== userId) {
          this.send(server, { type: 'opponent_joined', opponent: p.profile });
        } else {
          this.send(p.ws, { type: 'opponent_joined', opponent: profile });
        }
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let msg: ClientMessage;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    const participant = this.findParticipant(ws);
    if (!participant) return;

    if (msg.type === 'ping') {
      this.send(ws, { type: 'pong' });
      return;
    }

    if (msg.type === 'ready' && this.roomState === 'both_connected') {
      participant.ready = true;
      const allReady = [...this.participants.values()].every(p => p.ready);
      if (allReady) {
        this.broadcast({ type: 'both_ready' });
        await this.startCountdown();
      }
      return;
    }

    if (msg.type === 'scan_complete' && this.roomState === 'capturing') {
      participant.scanId = msg.scan_id;
      this.roomState = 'analyzing';

      // Notify everyone which side is done
      const sides = [...this.participants.keys()];
      const side = sides[0] === participant.userId ? 'a' : 'b';
      this.broadcast({ type: 'analyzing', side, done: true });

      // Check if both scans are done
      const allDone = [...this.participants.values()].every(p => p.scanId !== null);
      if (allDone) {
        await this.loadResultsAndReveal();
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const participant = this.findParticipant(ws);
    if (!participant) return;
    this.participants.delete(participant.userId);

    if (this.roomState !== 'complete') {
      this.broadcast({ type: 'opponent_disconnected' });
      // If a battle was in progress, mark it abandoned
      if (this.battleId) {
        await this.env.DB
          .prepare("UPDATE battles SET status = 'abandoned' WHERE id = ?")
          .bind(this.battleId)
          .run();
      }
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private async startCountdown(): Promise<void> {
    this.roomState = 'countdown';
    const counts = [3, 2, 1];
    for (const count of counts) {
      this.broadcast({ type: 'countdown', count });
      await sleep(1000);
    }
    this.roomState = 'capturing';
    this.broadcast({ type: 'capture_now' });
  }

  private async loadResultsAndReveal(): Promise<void> {
    if (!this.battleId) return;
    this.roomState = 'revealing_results';

    const battle = await this.env.DB
      .prepare(`
        SELECT b.*, ua.username AS ua_uname, ub.username AS ub_uname
        FROM battles b
        JOIN users ua ON ua.id = b.user_a_id
        JOIN users ub ON ub.id = b.user_b_id
        WHERE b.id = ?
      `)
      .bind(this.battleId)
      .first<{
        id: string; user_a_id: string; user_b_id: string;
        user_a_score: number; user_b_score: number;
        user_a_category_scores: string; user_b_category_scores: string;
        ua_uname: string; ub_uname: string;
      }>();

    if (!battle) {
      this.broadcast({ type: 'error', message: 'Could not load battle results' });
      return;
    }

    // Fetch feedback from scan records
    const participants = [...this.participants.values()];
    const feedbackMap = new Map<string, string>();
    for (const p of participants) {
      if (p.scanId) {
        const scan = await this.env.DB
          .prepare('SELECT ai_feedback FROM scans WHERE id = ?')
          .bind(p.scanId)
          .first<{ ai_feedback: string }>();
        feedbackMap.set(p.userId, scan?.ai_feedback ?? '');
      }
    }

    const scoreA = battle.user_a_score ?? 0;
    const scoreB = battle.user_b_score ?? 0;
    let winnerId: string | null = null;
    if (scoreA > scoreB) winnerId = battle.user_a_id;
    else if (scoreB > scoreA) winnerId = battle.user_b_id;

    const resultA: BattleResult = {
      user_id: battle.user_a_id,
      username: battle.ua_uname,
      overall_score: scoreA,
      category_scores: JSON.parse(battle.user_a_category_scores ?? '{}') as CategoryScores,
      ai_feedback: feedbackMap.get(battle.user_a_id) ?? '',
    };
    const resultB: BattleResult = {
      user_id: battle.user_b_id,
      username: battle.ub_uname,
      overall_score: scoreB,
      category_scores: JSON.parse(battle.user_b_category_scores ?? '{}') as CategoryScores,
      ai_feedback: feedbackMap.get(battle.user_b_id) ?? '',
    };

    // Persist result to DB
    await this.env.DB
      .prepare(`
        UPDATE battles
        SET winner_id = ?, status = 'complete', completed_at = unixepoch()
        WHERE id = ?
      `)
      .bind(winnerId, this.battleId)
      .run();

    // Update win/loss counters
    if (winnerId) {
      const loserId = winnerId === battle.user_a_id ? battle.user_b_id : battle.user_a_id;
      await this.env.DB.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').bind(winnerId).run();
      await this.env.DB.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').bind(loserId).run();
    }

    this.roomState = 'complete';
    this.broadcast({ type: 'results', result_a: resultA, result_b: resultB, winner_id: winnerId });
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // ws already closed
    }
  }

  private broadcast(msg: ServerMessage): void {
    for (const p of this.participants.values()) {
      this.send(p.ws, msg);
    }
  }

  private findParticipant(ws: WebSocket): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.ws === ws) return p;
    }
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
