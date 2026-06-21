import { createMiddleware } from 'hono/factory';
import { verifyAccessToken } from '../lib/auth';
import type { Env, JWTPayload } from '../types';

type Variables = { user: JWTPayload };

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }
    const token = authHeader.slice(7);
    try {
      const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
      c.set('user', payload);
      await next();
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
  }
);
