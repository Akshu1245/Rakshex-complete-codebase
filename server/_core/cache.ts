import Redis from "ioredis";
import { logger } from "./logger";
import crypto from "crypto";
import { trace, SpanKind } from "@opentelemetry/api";

const tracer = trace.getTracer("rakshex-redis");

/**
 * Span-wrapped Redis GET. Records hit/miss as span attribute.
 * Key is recorded; value is never stored in span attributes.
 */
async function spanGet(key: string): Promise<string | null> {
  const span = tracer.startSpan("redis.get", { kind: SpanKind.CLIENT });
  try {
    span.setAttribute("db.system", "redis");
    span.setAttribute("db.operation", "GET");
    span.setAttribute("cache.key", key);
    const value = await redis.get(key);
    span.setAttribute("cache.hit", value !== null);
    return value;
  } finally {
    span.end();
  }
}

/**
 * Span-wrapped Redis SETEX. Key and TTL are recorded; value is never in span attributes.
 */
async function spanSetex(key: string, ttl: number, value: string): Promise<void> {
  const span = tracer.startSpan("redis.setex", { kind: SpanKind.CLIENT });
  try {
    span.setAttribute("db.system", "redis");
    span.setAttribute("db.operation", "SETEX");
    span.setAttribute("cache.key", key);
    span.setAttribute("cache.ttl", ttl);
    await redis.setex(key, ttl, value);
  } finally {
    span.end();
  }
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on("error", (err: Error) => {
  logger.error({ err: err }, "Redis error");
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  DASHBOARD_STATS: 60, // 1 minute
  USER_COLLECTIONS: 30, // 30 seconds
  COMPLIANCE_SCORES: 300, // 5 minutes
  SCAN_RESULTS: 60, // 1 minute
};

// Generate cache keys
export const cacheKeys = {
  dashboardStats: (userId: number) => `dashboard:stats:${userId}`,
  userCollections: (userId: number) => `collections:list:${userId}`,
  complianceScore: (reportId: string) => `compliance:score:${reportId}`,
  scanResults: (scanId: string) => `scan:results:${scanId}`,
};

// Cache wrapper function
export async function getOrSetCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  try {
    // Try to get from cache
    const cached = await spanGet(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch fresh data
    const data = await fetchFn();

    // Store in cache
    await spanSetex(key, ttl, JSON.stringify(data));

    return data;
  } catch (error) {
    // Fallback to direct fetch if Redis fails
    logger.warn({ err: error }, "Cache fetch failed, returning fresh data");
    return fetchFn();
  }
}

// Invalidate cache keys by pattern
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.warn({ err: error }, "Cache invalidation failed");
  }
}

// Invalidate user-related caches
export async function invalidateUserCache(userId: number): Promise<void> {
  await invalidateCache(`*:${userId}*`);
}

// Cache middleware for tRPC
export function createCacheMiddleware<T>(
  getCacheKey: (input: T, userId: number) => string,
  ttl: number,
) {
  return async (input: T, userId: number, fetchFn: () => Promise<any>): Promise<any> => {
    const key = getCacheKey(input, userId);
    return getOrSetCache(key, ttl, fetchFn);
  };
}

/**
 * Distributed sliding-window rate limit, backed by a Redis sorted-set.
 *
 * The window is implemented by storing one member per request scored by
 * `Date.now()`. On each call we:
 *   1. Drop any members older than `now - windowMs`.
 *   2. Insert the current request.
 *   3. Count the surviving members.
 *
 * If the count exceeds `limit`, the request is rejected. Because every
 * step runs inside a single Redis pipeline, the operation is atomic
 * across multiple server instances — replacing the old per-process
 * `Map<userId, count>` rate limiters that broke as soon as the API was
 * scaled horizontally.
 *
 * Fails open on Redis errors: if Redis is down we'd rather let the
 * extension keep working than 429 every legitimate request.
 */
export async function rateLimitSlidingWindow(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; current: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  // The score is `now`, the member is unique-per-call so duplicate
  // calls in the same millisecond don't collide on the same member.
  const member = `${now}-${crypto.randomBytes(6).toString("hex")}`;

  try {
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, member);
    pipeline.zcard(key);
    // Garbage-collect the key after one full window of inactivity.
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();
    const current = Number(results?.[2]?.[1] ?? 0);
    return {
      allowed: current <= limit,
      current,
      resetAt: now + windowMs,
    };
  } catch (err) {
    const errorDetail = err instanceof Error ? err.message : err;
    logger.warn(
      { error: errorDetail, key },
      `[RateLimit] Redis check failed for ${key}, failing open`,
    );
    return { allowed: true, current: 0, resetAt: now + windowMs };
  }
}
