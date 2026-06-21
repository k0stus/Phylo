import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth';
import type { Env, JWTPayload, InviteCodePayload } from '../types';

const friends = new Hono<{ Bindings: Env; Variables: { user: JWTPayload } }>();

// Generate a shareable invite code for a friend battle
friends.post('/invite', requireAuth, async (c) => {
  const user = c.get('user');
  const ttl = parseInt(c.env.INVITE_CODE_TTL_SECONDS, 10);

  // Create a pending battle record so both users share the same battle ID from the start
  const battleId = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO battles (id, user_a_id, user_b_id, status) VALUES (?, ?, \'\', \'pending\')')
    .bind(battleId, user.sub)
    .run();

  const code = generateCode();
  const payload: InviteCodePayload = {
    inviter_id: user.sub,
    inviter_username: user.username,
    battle_id: battleId,
    expires_at: Math.floor(Date.now() / 1000) + ttl,
  };

  await c.env.INVITE_CODES.put(code, JSON.stringify(payload), { expirationTtl: ttl });

  const deepLink = `phylo://battle/invite/${code}`;
  return c.json({ code, deep_link: deepLink, battle_id: battleId, expires_in_seconds: ttl });
});

// Validate an invite code and return inviter profile + battle id (call before connecting WS)
friends.get('/invite/:code', requireAuth, async (c) => {
  const code = c.req.param('code');
  const user = c.get('user');

  const raw = await c.env.INVITE_CODES.get(code);
  if (!raw) return c.json({ error: 'Invite code not found or expired' }, 404);

  const payload = JSON.parse(raw) as InviteCodePayload;

  if (payload.inviter_id === user.sub) {
    return c.json({ error: 'Cannot join your own invite' }, 400);
  }

  // Slot user B into the battle record
  await c.env.DB
    .prepare('UPDATE battles SET user_b_id = ? WHERE id = ? AND user_b_id = \'\'')
    .bind(user.sub, payload.battle_id)
    .run();

  // Delete the code so it can't be reused
  await c.env.INVITE_CODES.delete(code);

  return c.json({
    battle_id: payload.battle_id,
    inviter: { id: payload.inviter_id, username: payload.inviter_username },
  });
});

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

export default friends;
