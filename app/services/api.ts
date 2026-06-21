import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

const ACCESS_KEY  = 'phylo_access_token';
const REFRESH_KEY = 'phylo_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function storeTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access),
    SecureStore.setItemAsync(REFRESH_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    await clearTokens();
    return null;
  }

  const data = await res.json() as { access_token: string; refresh_token: string };
  await storeTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch(path, options, false);
  }

  return res;
}

// --- Auth ---
export async function signup(data: {
  email: string; username: string; password: string; country?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{
    access_token?: string; refresh_token?: string;
    user?: { id: string; email: string; username: string; country: string | null };
    error?: string;
  }>;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json() as Promise<{
    access_token?: string; refresh_token?: string;
    user?: { id: string; email: string; username: string; country: string | null; wins: number; losses: number };
    error?: string;
  }>;
}

export async function logout(refreshToken: string) {
  await apiFetch('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  await clearTokens();
}

// --- Analyze ---
export async function analyzePhoto(opts: {
  image: string;
  media_type: 'image/jpeg' | 'image/png' | 'image/webp';
  battle_id?: string;
}) {
  const res = await apiFetch('/analyze', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
  return res.json() as Promise<{
    scan_id?: string;
    overall_score?: number;
    category_scores?: Record<string, number>;
    ai_feedback?: string;
    usage?: { used: number; limit: number };
    error?: string;
  }>;
}

// --- Users ---
export async function getPublicProfile(username: string) {
  const res = await apiFetch(`/users/${username}`);
  return res.json() as Promise<{
    id: string; username: string; country: string | null; wins: number; losses: number;
    error?: string;
  }>;
}

export async function getMyProfile() {
  const res = await apiFetch('/users/me/profile');
  return res.json() as Promise<{
    id: string; email: string; username: string; country: string | null; wins: number; losses: number;
    error?: string;
  }>;
}

// --- Friends / Invites ---
export async function createInvite() {
  const res = await apiFetch('/friends/invite', { method: 'POST' });
  return res.json() as Promise<{
    code?: string; deep_link?: string; battle_id?: string; expires_in_seconds?: number;
    error?: string;
  }>;
}

export async function acceptInvite(code: string) {
  const res = await apiFetch(`/friends/invite/${code}`);
  return res.json() as Promise<{
    battle_id?: string;
    inviter?: { id: string; username: string };
    error?: string;
  }>;
}

// --- Battles ---
export async function getBattleHistory(opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.limit)  params.set('limit',  String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const res = await apiFetch(`/battles/history?${params}`);
  return res.json() as Promise<{
    battles?: Array<{
      id: string; opponent_username: string; my_score: number; opponent_score: number;
      result: 'win' | 'loss' | 'draw'; created_at: number; completed_at: number;
    }>;
    error?: string;
  }>;
}

export async function getBattleDetail(id: string) {
  const res = await apiFetch(`/battles/${id}`);
  return res.json();
}
