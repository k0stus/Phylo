import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth';
import type { Env, JWTPayload, UserRecord } from '../types';

const users = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

// Public profile lookup by username
users.get('/:username', async (c) => {
  const username = c.req.param('username');

  const user = await c.env.DB
    .prepare('SELECT id, username, country, wins, losses, created_at FROM users WHERE username = ?')
    .bind(username)
    .first<Pick<UserRecord, 'id' | 'username' | 'country' | 'wins' | 'losses' | 'created_at'>>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json(user);
});

// My own profile (authenticated)
users.get('/me/profile', requireAuth, async (c) => {
  const user = c.get('user');

  const profile = await c.env.DB
    .prepare('SELECT id, email, username, country, wins, losses, created_at FROM users WHERE id = ?')
    .bind(user.sub)
    .first<Omit<UserRecord, 'password_hash'>>();

  if (!profile) return c.json({ error: 'User not found' }, 404);

  return c.json(profile);
});

// Update own profile
users.patch('/me/profile', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ country?: string; username?: string }>();

  if (body.username) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .bind(body.username, user.sub)
      .first();
    if (existing) return c.json({ error: 'Username already taken' }, 409);

    await c.env.DB
      .prepare('UPDATE users SET username = ? WHERE id = ?')
      .bind(body.username, user.sub)
      .run();
  }

  if (body.country !== undefined) {
    await c.env.DB
      .prepare('UPDATE users SET country = ? WHERE id = ?')
      .bind(body.country || null, user.sub)
      .run();
  }

  return c.json({ ok: true });
});

export default users;
