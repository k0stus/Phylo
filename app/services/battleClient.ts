import { WS_BASE_URL } from '../constants/config';
import { getAccessToken } from './api';

export type BattleServerMessage =
  | { type: 'waiting_for_opponent' }
  | { type: 'opponent_joined'; opponent: PublicProfile }
  | { type: 'both_ready' }
  | { type: 'countdown'; count: number }
  | { type: 'capture_now' }
  | { type: 'analyzing'; side: 'a' | 'b'; done: boolean }
  | { type: 'results'; result_a: BattleResult; result_b: BattleResult; winner_id: string | null }
  | { type: 'opponent_disconnected' }
  | { type: 'error'; message: string }
  | { type: 'pong' };

export interface PublicProfile {
  id: string;
  username: string;
  country: string | null;
  wins: number;
  losses: number;
}

export interface BattleResult {
  user_id: string;
  username: string;
  overall_score: number;
  category_scores: Record<string, number>;
  ai_feedback: string;
}

export type MatchmakingServerMessage =
  | { type: 'matched'; battle_id: string; opponent: PublicProfile }
  | { type: 'error'; message: string };

type MessageHandler<T> = (msg: T) => void;

class WSClient<TServer> {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler<TServer>> = new Set();
  private onClose: (() => void) | null = null;

  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Cloudflare Workers doesn't support Auth headers on WS upgrade,
      // so we pass the token as a query param (short-lived access token is acceptable here)
      const fullUrl = `${url}&token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error('WebSocket connection failed'));
      this.ws.onclose = () => this.onClose?.();
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as TServer;
          for (const h of this.handlers) h(msg);
        } catch { /* malformed */ }
      };
    });
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler<TServer>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  setOnClose(cb: () => void): void {
    this.onClose = cb;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}

// Battle room client
export async function connectToBattleRoom(battleId: string): Promise<WSClient<BattleServerMessage>> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const client = new WSClient<BattleServerMessage>();
  const url = `${WS_BASE_URL}/ws/battle?battleId=${encodeURIComponent(battleId)}`;
  await client.connect(url, token);
  return client;
}

// Matchmaking queue client
export async function connectToMatchmaking(): Promise<WSClient<MatchmakingServerMessage>> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const client = new WSClient<MatchmakingServerMessage>();
  await client.connect(`${WS_BASE_URL}/ws/matchmaking?`, token);
  return client;
}

export { WSClient };
