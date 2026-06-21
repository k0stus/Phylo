import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth';
import type { Env, JWTPayload, BattleRecord } from '../types';

const battles = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

// List past battles for logged-in user
battles.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const rows = await c.env.DB
    .prepare(`
      SELECT
        b.id, b.user_a_id, b.user_b_id,
        b.user_a_score, b.user_b_score,
        b.winner_id, b.status, b.created_at, b.completed_at,
        ua.username AS user_a_username,
        ub.username AS user_b_username
      FROM battles b
      JOIN users ua ON ua.id = b.user_a_id
      LEFT JOIN users ub ON ub.id = b.user_b_id
      WHERE (b.user_a_id = ? OR b.user_b_id = ?) AND b.status = 'complete'
      ORDER BY b.completed_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(user.sub, user.sub, limit, offset)
    .all<BattleRecord & { user_a_username: string; user_b_username: string }>();

  const battles = rows.results.map(b => {
    const iAmA = b.user_a_id === user.sub;
    const myScore  = iAmA ? b.user_a_score : b.user_b_score;
    const oppScore = iAmA ? b.user_b_score : b.user_a_score;
    const oppUsername = iAmA ? b.user_b_username : b.user_a_username;

    let result: 'win' | 'loss' | 'draw' = 'draw';
    if (b.winner_id === user.sub) result = 'win';
    else if (b.winner_id && b.winner_id !== user.sub) result = 'loss';

    return {
      id: b.id,
      opponent_username: oppUsername,
      my_score: myScore,
      opponent_score: oppScore,
      result,
      created_at: b.created_at,
      completed_at: b.completed_at,
    };
  });

  return c.json({ battles, offset, limit });
});

// Full detail of a single battle
battles.get('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const battleId = c.req.param('id');

  const b = await c.env.DB
    .prepare(`
      SELECT
        b.*,
        ua.username AS user_a_username, ua.country AS user_a_country,
        ub.username AS user_b_username, ub.country AS user_b_country
      FROM battles b
      JOIN users ua ON ua.id = b.user_a_id
      LEFT JOIN users ub ON ub.id = b.user_b_id
      WHERE b.id = ?
    `)
    .bind(battleId)
    .first<BattleRecord & {
      user_a_username: string; user_a_country: string;
      user_b_username: string; user_b_country: string;
    }>();

  if (!b) return c.json({ error: 'Battle not found' }, 404);

  // Only participants can view details
  if (b.user_a_id !== user.sub && b.user_b_id !== user.sub) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  return c.json({
    id: b.id,
    status: b.status,
    created_at: b.created_at,
    completed_at: b.completed_at,
    winner_id: b.winner_id,
    user_a: {
      id: b.user_a_id,
      username: b.user_a_username,
      country: b.user_a_country,
      overall_score: b.user_a_score,
      category_scores: b.user_a_category_scores ? JSON.parse(b.user_a_category_scores) : null,
    },
    user_b: {
      id: b.user_b_id,
      username: b.user_b_username,
      country: b.user_b_country,
      overall_score: b.user_b_score,
      category_scores: b.user_b_category_scores ? JSON.parse(b.user_b_category_scores) : null,
    },
  });
});

export default battles;
