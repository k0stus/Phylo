import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
} from '../lib/auth';
import type { Env, UserRecord } from '../types';

const auth = new Hono<{ Bindings: Env }>();

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  country: z.string().length(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

auth.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, username, password, country } = c.req.valid('json');

  const existing = await c.env.DB
    .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
    .bind(email, username)
    .first<{ id: string }>();

  if (existing) {
    return c.json({ error: 'Email or username already taken' }, 409);
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  await c.env.DB
    .prepare('INSERT INTO users (id, email, username, password_hash, country) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, username, password_hash, country ?? null)
    .run();

  const accessToken  = await signAccessToken({ sub: id, email, username }, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken(id, c.env.JWT_SECRET);
  const tokenHash    = await hashToken(refreshToken);

  await c.env.DB
    .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, tokenHash, refreshTokenExpiresAt())
    .run();

  return c.json({ access_token: accessToken, refresh_token: refreshToken, user: { id, email, username, country: country ?? null } }, 201);
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<UserRecord>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const accessToken  = await signAccessToken({ sub: user.id, email: user.email, username: user.username }, c.env.JWT_SECRET);
  const refreshToken = await signRefreshToken(user.id, c.env.JWT_SECRET);
  const tokenHash    = await hashToken(refreshToken);

  await c.env.DB
    .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), user.id, tokenHash, refreshTokenExpiresAt())
    .run();

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: { id: user.id, email: user.email, username: user.username, country: user.country, wins: user.wins, losses: user.losses },
  });
});

auth.post('/refresh', async (c) => {
  const body = await c.req.json<{ refresh_token: string }>();
  if (!body?.refresh_token) return c.json({ error: 'refresh_token required' }, 400);

  let userId: string;
  try {
    const payload = await verifyRefreshToken(body.refresh_token, c.env.JWT_SECRET);
    userId = payload.sub;
  } catch {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }

  const tokenHash = await hashToken(body.refresh_token);
  const storedToken = await c.env.DB
    .prepare('SELECT id FROM refresh_tokens WHERE token_hash = ? AND user_id = ? AND expires_at > ?')
    .bind(tokenHash, userId, Math.floor(Date.now() / 1000))
    .first<{ id: string }>();

  if (!storedToken) return c.json({ error: 'Refresh token not found or expired' }, 401);

  const user = await c.env.DB
    .prepare('SELECT id, email, username FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; username: string }>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  // rotate refresh token
  await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(storedToken.id).run();

  const newRefreshToken = await signRefreshToken(userId, c.env.JWT_SECRET);
  const newTokenHash    = await hashToken(newRefreshToken);
  const accessToken     = await signAccessToken({ sub: user.id, email: user.email, username: user.username }, c.env.JWT_SECRET);

  await c.env.DB
    .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, newTokenHash, refreshTokenExpiresAt())
    .run();

  return c.json({ access_token: accessToken, refresh_token: newRefreshToken });
});

auth.post('/logout', async (c) => {
  const body = await c.req.json<{ refresh_token?: string }>();
  if (body?.refresh_token) {
    const tokenHash = await hashToken(body.refresh_token);
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).run();
  }
  return c.json({ ok: true });
});

export default auth;
