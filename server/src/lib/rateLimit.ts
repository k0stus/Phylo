import type { D1Database } from '@cloudflare/workers-types';

export async function checkAndIncrementScanUsage(
  db: D1Database,
  userId: string,
  limit: number
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  const row = await db
    .prepare('SELECT count FROM daily_scan_usage WHERE user_id = ? AND date = ?')
    .bind(userId, today)
    .first<{ count: number }>();

  const current = row?.count ?? 0;

  if (current >= limit) {
    return { allowed: false, used: current, limit };
  }

  if (row) {
    await db
      .prepare('UPDATE daily_scan_usage SET count = count + 1 WHERE user_id = ? AND date = ?')
      .bind(userId, today)
      .run();
  } else {
    await db
      .prepare('INSERT INTO daily_scan_usage (user_id, date, count) VALUES (?, ?, 1)')
      .bind(userId, today)
      .run();
  }

  return { allowed: true, used: current + 1, limit };
}

export async function getScanUsage(
  db: D1Database,
  userId: string
): Promise<{ used: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db
    .prepare('SELECT count FROM daily_scan_usage WHERE user_id = ? AND date = ?')
    .bind(userId, today)
    .first<{ count: number }>();
  return { used: row?.count ?? 0 };
}
