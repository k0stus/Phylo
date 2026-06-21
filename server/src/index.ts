import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes    from './routes/auth';
import analyzeRoute  from './routes/analyze';
import usersRoutes   from './routes/users';
import friendsRoutes from './routes/friends';
import battlesRoutes from './routes/battles';
import { requireAuth } from './middleware/requireAuth';
import type { Env, JWTPayload } from './types';

export { BattleRoom }      from './durable-objects/BattleRoom';
export { MatchmakingQueue } from './durable-objects/MatchmakingQueue';

const app = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/health', c => c.json({ status: 'ok', ts: Date.now() }));

app.route('/auth',    authRoutes);
app.route('/analyze', analyzeRoute);
app.route('/users',   usersRoutes);
app.route('/friends', friendsRoutes);
app.route('/battles', battlesRoutes);

// WebSocket: connect to a BattleRoom (invite or post-matchmaking)
// The client must supply ?battleId=&userId=&username=&country=&wins=&losses=
app.get('/ws/battle', requireAuth, async (c) => {
  const user = c.get('user');
  const battleId = c.req.query('battleId');

  if (!battleId) return c.json({ error: 'battleId required' }, 400);

  // Verify participation
  const battle = await c.env.DB
    .prepare('SELECT user_a_id, user_b_id FROM battles WHERE id = ?')
    .bind(battleId)
    .first<{ user_a_id: string; user_b_id: string }>();

  if (!battle) return c.json({ error: 'Battle not found' }, 404);
  if (battle.user_a_id !== user.sub && battle.user_b_id !== user.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Look up user profile for display in the room
  const profile = await c.env.DB
    .prepare('SELECT username, country, wins, losses FROM users WHERE id = ?')
    .bind(user.sub)
    .first<{ username: string; country: string | null; wins: number; losses: number }>();

  if (!profile) return c.json({ error: 'User not found' }, 404);

  const roomId = c.env.BATTLE_ROOM.idFromName(battleId);
  const stub   = c.env.BATTLE_ROOM.get(roomId);

  const url = new URL(c.req.url);
  url.pathname = '/';
  url.searchParams.set('battleId', battleId);
  url.searchParams.set('userId',   user.sub);
  url.searchParams.set('username', profile.username);
  url.searchParams.set('country',  profile.country ?? '');
  url.searchParams.set('wins',     String(profile.wins));
  url.searchParams.set('losses',   String(profile.losses));

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// WebSocket: random matchmaking queue
app.get('/ws/matchmaking', requireAuth, async (c) => {
  const user = c.get('user');

  const profile = await c.env.DB
    .prepare('SELECT username, country, wins, losses FROM users WHERE id = ?')
    .bind(user.sub)
    .first<{ username: string; country: string | null; wins: number; losses: number }>();

  if (!profile) return c.json({ error: 'User not found' }, 404);

  // Singleton queue — always same ID
  const queueId = c.env.MATCHMAKING_QUEUE.idFromName('global-queue');
  const stub    = c.env.MATCHMAKING_QUEUE.get(queueId);

  const url = new URL(c.req.url);
  url.pathname = '/';
  url.searchParams.set('userId',   user.sub);
  url.searchParams.set('username', profile.username);
  url.searchParams.set('country',  profile.country ?? '');
  url.searchParams.set('wins',     String(profile.wins));
  url.searchParams.set('losses',   String(profile.losses));

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

app.notFound(c => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
