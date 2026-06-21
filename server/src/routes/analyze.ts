import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth';
import { analyzePhysique } from '../lib/claude';
import { checkAndIncrementScanUsage } from '../lib/rateLimit';
import type { Env, JWTPayload } from '../types';

const analyze = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

analyze.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.env.DAILY_SCAN_LIMIT, 10);

  // Rate limit check (covers solo + battle scans)
  const usage = await checkAndIncrementScanUsage(c.env.DB, user.sub, limit);
  if (!usage.allowed) {
    return c.json(
      { error: 'Daily scan limit reached', used: usage.used, limit: usage.limit },
      429
    );
  }

  const body = await c.req.json<{
    image: string;
    media_type: 'image/jpeg' | 'image/png' | 'image/webp';
    battle_id?: string;
  }>();

  if (!body.image || !body.media_type) {
    return c.json({ error: 'image and media_type are required' }, 400);
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(body.media_type)) {
    return c.json({ error: 'Unsupported media_type' }, 400);
  }

  // If a battle_id is provided, verify the battle exists and this user is a participant
  if (body.battle_id) {
    const battle = await c.env.DB
      .prepare('SELECT id, user_a_id, user_b_id, status FROM battles WHERE id = ?')
      .bind(body.battle_id)
      .first<{ id: string; user_a_id: string; user_b_id: string; status: string }>();

    if (!battle) return c.json({ error: 'Battle not found' }, 404);
    if (battle.user_a_id !== user.sub && battle.user_b_id !== user.sub) {
      return c.json({ error: 'Not a participant in this battle' }, 403);
    }
    if (battle.status !== 'pending' && battle.status !== 'analyzing') {
      return c.json({ error: 'Battle is not in an active scanning state' }, 409);
    }
  }

  let result;
  try {
    result = await analyzePhysique(body.image, body.media_type, c.env.ANTHROPIC_API_KEY);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return c.json({ error: msg }, 502);
  }

  const scanId = crypto.randomUUID();
  await c.env.DB
    .prepare(
      'INSERT INTO scans (id, user_id, overall_score, category_scores, ai_feedback, battle_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      scanId,
      user.sub,
      result.overall_score,
      JSON.stringify(result.category_scores),
      result.ai_feedback,
      body.battle_id ?? null
    )
    .run();

  // If this is a battle scan, update the battle record
  if (body.battle_id) {
    const battle = await c.env.DB
      .prepare('SELECT user_a_id, user_a_score, user_b_score FROM battles WHERE id = ?')
      .bind(body.battle_id)
      .first<{ user_a_id: string; user_a_score: number | null; user_b_score: number | null }>();

    if (battle) {
      const isUserA = battle.user_a_id === user.sub;
      if (isUserA) {
        await c.env.DB
          .prepare('UPDATE battles SET user_a_score = ?, user_a_category_scores = ?, status = ? WHERE id = ?')
          .bind(result.overall_score, JSON.stringify(result.category_scores), 'analyzing', body.battle_id)
          .run();
      } else {
        await c.env.DB
          .prepare('UPDATE battles SET user_b_score = ?, user_b_category_scores = ?, status = ? WHERE id = ?')
          .bind(result.overall_score, JSON.stringify(result.category_scores), 'analyzing', body.battle_id)
          .run();
      }
    }
  }

  return c.json({
    scan_id: scanId,
    overall_score: result.overall_score,
    category_scores: result.category_scores,
    ai_feedback: result.ai_feedback,
    usage: { used: usage.used, limit: usage.limit },
  });
});

export default analyze;
