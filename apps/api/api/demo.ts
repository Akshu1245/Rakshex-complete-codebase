/**
 * Public demo scan router — the no-login wedge.
 *
 * `demo.scan` accepts a raw collection (Postman/OpenAPI-style JSON) and returns
 * static-analysis findings without auth or persistence. It is IP rate-limited
 * (Redis with an in-memory fallback) so it can't be abused as free compute.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";
import { performDemoScan } from "../utils/demoScanner";
import { detectSync } from "../engines/promptInjectionEngine";
import { detectPII } from "../engines/piiDetector";

const MAX_DEMO_SCANS_PER_HOUR = 15;
const WINDOW_SECONDS = 60 * 60;

// In-memory fallback when Redis is unavailable — keeps the limit working
// (per-replica) rather than failing open.
const fallbackCounters = new Map<string, { count: number; expiresAt: number }>();

function fallbackIncr(key: string): number {
  const now = Date.now();
  const entry = fallbackCounters.get(key);
  if (!entry || now > entry.expiresAt) {
    fallbackCounters.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function clientKey(ip: string | undefined): string {
  const hourBucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
  return `demo_scan:${ip || "unknown"}:${hourBucket}`;
}

export const demoRouter = router({
  scan: publicProcedure
    .input(
      z.object({
        // Accept the parsed collection object; cap size via JSON string length.
        collection: z.unknown(),
        filename: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Reject oversized payloads early (≈2MB of JSON).
      const serialized = JSON.stringify(input.collection ?? {});
      if (serialized.length > 2_000_000) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Collection is too large for the demo. Sign up to scan large collections.",
        });
      }

      const ip = ctx.req?.ip;
      const key = clientKey(ip);
      let used: number;
      try {
        const pipeline = redis.multi();
        pipeline.incr(key);
        pipeline.expire(key, WINDOW_SECONDS);
        const results = await pipeline.exec();
        const incr = results?.[0]?.[1];
        used = typeof incr === "number" ? incr : fallbackIncr(key);
      } catch (err) {
        logger.warn({ err }, "[demo.scan] Redis unavailable, using in-memory rate limit");
        used = fallbackIncr(key);
      }

      if (used > MAX_DEMO_SCANS_PER_HOUR) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Demo limit reached (${MAX_DEMO_SCANS_PER_HOUR}/hour). Sign up for unlimited scans.`,
        });
      }

      const result = performDemoScan(
        (input.collection ?? {}) as Parameters<typeof performDemoScan>[0],
      );
      logger.info(
        { findings: result.findings.length, ip: ip ? "present" : "none" },
        "[demo.scan] completed",
      );
      return { ...result, remaining: Math.max(0, MAX_DEMO_SCANS_PER_HOUR - used) };
      return { ...result, remaining: Math.max(0, MAX_DEMO_SCANS_PER_HOUR - used) };
    }),

  /**
   * Public prompt injection + PII demo.
   * This is the killer feature for competitions — shows real AI-powered security live.
   */
  scanPrompt: publicProcedure
    .input(z.object({ prompt: z.string().min(1).max(8000) }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req?.ip;
      const key = clientKey(ip);

      let used: number;
      try {
        const pipeline = redis.multi();
        pipeline.incr(key);
        pipeline.expire(key, WINDOW_SECONDS);
        const results = await pipeline.exec();
        const incr = results?.[0]?.[1];
        used = typeof incr === "number" ? incr : fallbackIncr(key);
      } catch {
        used = fallbackIncr(key);
      }

      if (used > MAX_DEMO_SCANS_PER_HOUR) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Demo limit reached. Sign up for unlimited scans.`,
        });
      }

      const injection = detectSync(input.prompt);
      const pii = detectPII(input.prompt);

      const riskScore = Math.min(
        100,
        Math.round(
          injection.confidence * 55 +
            (pii.hasPII ? pii.count * 14 : 0) +
            (injection.threatLevel === "critical" ? 30 : injection.threatLevel === "high" ? 18 : 0),
        ),
      );

      return {
        injection,
        pii,
        riskScore: Math.max(8, Math.min(100, riskScore)),
        remaining: Math.max(0, MAX_DEMO_SCANS_PER_HOUR - used),
      };
    }),
});
