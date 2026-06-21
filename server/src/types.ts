export interface Env {
  DB: D1Database;
  RATE_LIMITS: KVNamespace;
  INVITE_CODES: KVNamespace;
  BATTLE_ROOM: DurableObjectNamespace;
  MATCHMAKING_QUEUE: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  DAILY_SCAN_LIMIT: string;
  INVITE_CODE_TTL_SECONDS: string;
  MATCHMAKING_TIMEOUT_SECONDS: string;
}

export interface JWTPayload {
  sub: string;   // user id
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  country: string | null;
  wins: number;
  losses: number;
  created_at: number;
}

export interface ScanRecord {
  id: string;
  user_id: string;
  overall_score: number;
  category_scores: string; // JSON
  ai_feedback: string;
  battle_id: string | null;
  created_at: number;
}

export interface BattleRecord {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_score: number | null;
  user_b_score: number | null;
  user_a_category_scores: string | null; // JSON
  user_b_category_scores: string | null; // JSON
  winner_id: string | null;
  status: 'pending' | 'analyzing' | 'complete' | 'abandoned';
  created_at: number;
  completed_at: number | null;
}

export interface CategoryScores {
  muscularity: number;
  leanness: number;
  symmetry: number;
  posing: number;
  conditioning: number;
}

export interface AnalysisResult {
  overall_score: number;
  category_scores: CategoryScores;
  ai_feedback: string;
}

// WebSocket messages (app <-> BattleRoom)
export type ClientMessage =
  | { type: 'ready' }
  | { type: 'scan_complete'; scan_id: string }
  | { type: 'ping' };

export type ServerMessage =
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
  category_scores: CategoryScores;
  ai_feedback: string;
}

// Invite code payload stored in KV
export interface InviteCodePayload {
  inviter_id: string;
  inviter_username: string;
  battle_id: string;
  expires_at: number;
}
