/**
 * D1 sliding-window rate limiter — replaces the Express/Redis rate limiter.
 *
 * NOT KV: KV allows ~1,000 writes/day on the free tier; per-request counters
 * would exhaust that in minutes. D1 allows 100k writes/day.
 */
import { sql } from "drizzle-orm";
import type { WorkersDb } from "../db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

export async function checkRateLimit(
  db: WorkersDb,
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const bucketKey = `rl:${key}`;
  // Prune this key's expired buckets so the table stays small.
  await db.run(
    sql`DELETE FROM rate_limit_events WHERE bucket_key = ${bucketKey} AND window_start < ${windowStart}`,
  );
  const rows = await db.all<{ count: number }>(
    sql`INSERT INTO rate_limit_events (bucket_key, window_start, count)
        VALUES (${bucketKey}, ${windowStart}, 1)
        ON CONFLICT (bucket_key, window_start) DO UPDATE SET count = count + 1
        RETURNING count`,
  );
  const count = rows[0]?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAtMs: windowStart + windowMs,
  };
}
