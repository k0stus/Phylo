/**
 * Singleton Durable Object acting as a matchmaking queue.
 * Pairs users by order of arrival. If no match within TIMEOUT seconds, client is rejected.
 */

interface WaitingEntry {
  ws: WebSocket;
  userId: string;
  username: string;
  country: string | null;
  wins: number;
  losses: number;
  joinedAt: number;
}

export class MatchmakingQueue {
  private state: DurableObjectState;
  private env: {
    DB: D1Database;
    BATTLE_ROOM: DurableObjectNamespace;
    MATCHMAKING_TIMEOUT_SECONDS: string;
  };
  private queue: WaitingEntry[] = [];

  constructor(state: DurableObjectState, env: {
    DB: D1Database;
    BATTLE_ROOM: DurableObjectNamespace;
    MATCHMAKING_TIMEOUT_SECONDS: string;
  }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId   = url.searchParams.get('userId');
    const username = url.searchParams.get('username');
    const country  = url.searchParams.get('country');
    const wins     = parseInt(url.searchParams.get('wins') ?? '0', 10);
    const losses   = parseInt(url.searchParams.get('losses') ?? '0', 10);

    if (!userId || !username) {
      return new Response('Missing userId or username', { status: 400 });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.state.acceptWebSocket(server);

    const entry: WaitingEntry = {
      ws: server,
      userId,
      username,
      country: country || null,
      wins,
      losses,
      joinedAt: Date.now(),
    };

    // Look for a waiting opponent (not the same user)
    const opponentIdx = this.queue.findIndex(e => e.userId !== userId);

    if (opponentIdx !== -1) {
      const opponent = this.queue.splice(opponentIdx, 1)[0];
      await this.pairUsers(entry, opponent);
    } else {
      this.queue.push(entry);
      // Schedule a timeout alarm
      const timeoutMs = parseInt(this.env.MATCHMAKING_TIMEOUT_SECONDS, 10) * 1000;
      await this.state.storage.setAlarm(Date.now() + timeoutMs);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    // Remove entries that have been waiting too long
    const now = Date.now();
    const timeoutMs = parseInt(this.env.MATCHMAKING_TIMEOUT_SECONDS, 10) * 1000;
    const expired: WaitingEntry[] = [];
    this.queue = this.queue.filter(e => {
      if (now - e.joinedAt >= timeoutMs) {
        expired.push(e);
        return false;
      }
      return true;
    });

    for (const e of expired) {
      try {
        e.ws.send(JSON.stringify({ type: 'error', message: 'No opponent found. Please try again.' }));
        e.ws.close(1000, 'Matchmaking timeout');
      } catch {
        // already closed
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.queue = this.queue.filter(e => e.ws !== ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async webSocketMessage(_ws: WebSocket, _msg: string | ArrayBuffer): Promise<void> {
    // no-op for matchmaking queue
  }

  private async pairUsers(a: WaitingEntry, b: WaitingEntry): Promise<void> {
    // Create a battle record
    const battleId = crypto.randomUUID();
    await this.env.DB
      .prepare('INSERT INTO battles (id, user_a_id, user_b_id, status) VALUES (?, ?, ?, \'pending\')')
      .bind(battleId, a.userId, b.userId)
      .run();

    // Tell both clients the battle ID and room URL so they can connect to BattleRoom
    const matchMsg = (opponent: WaitingEntry) => JSON.stringify({
      type: 'matched',
      battle_id: battleId,
      opponent: {
        id: opponent.userId,
        username: opponent.username,
        country: opponent.country,
        wins: opponent.wins,
        losses: opponent.losses,
      },
    });

    try {
      a.ws.send(matchMsg(b));
      a.ws.close(1000, 'Matched');
    } catch { /* */ }

    try {
      b.ws.send(matchMsg(a));
      b.ws.close(1000, 'Matched');
    } catch { /* */ }
  }
}
