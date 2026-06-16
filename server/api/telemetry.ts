/**
 * Telemetry Ingest API Router
 *
 * Accepts batched telemetry events from the Rakshex SDK.
 * Validates, de-duplicates, enqueues to BullMQ for async processing,
 * and provides query endpoints for the dashboard.
 */
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { z } from "zod";
import * as db from "../db";
import { telemetryQueue } from "../queues";
import { redis } from "../_core/cache";

// ── Validation schema ──────────────────────────────────────────────────────

const toolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.unknown()).optional(),
  result: z.unknown().optional(),
  latencyMs: z.number().optional(),
});

const telemetryEventSchema = z.object({
  eventId: z.string().uuid(),
  workspaceId: z.string().min(1),
  agentId: z.string().min(1),
  userId: z.string().optional(),
  provider: z.enum([
    "openai",
    "anthropic",
    "bedrock",
    "vertex",
    "cohere",
    "mistral",
    "groq",
    "ollama",
    "vllm",
  ]),
  model: z.string().min(1),
  requestTimestamp: z.string().datetime(),
  latencyMs: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cachedTokens: z.number().int().min(0).default(0),
  costUsd: z.number().min(0),
  status: z.enum(["ok", "error", "timeout", "blocked"]),
  redactionCount: z.number().int().min(0).default(0),
  promptHash: z.string().length(64),
  responseHash: z.string().length(64),
  toolCalls: z.array(toolCallSchema).nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
});

const ingestSchema = z.object({
  events: z.array(telemetryEventSchema).min(1).max(100),
  sdkVersion: z.string().optional(),
});

// ── Redis API key cache (5-min TTL) ────────────────────────────────────────

async function resolveWorkspaceByApiKey(apiKey: string): Promise<number | null> {
  const cacheKey = `apikey:user:${apiKey.slice(0, 12)}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return parseInt(cached, 10);
  } catch {
    /* Redis down, fall through */
  }

  const user = await db.getUserByApiKey(apiKey);
  if (!user) return null;

  try {
    await redis.setex(cacheKey, 300, String(user.id));
  } catch {
    /* Best effort */
  }

  return user.id;
}

// ── Rate limit check ───────────────────────────────────────────────────────

async function checkTelemetryRateLimit(workspaceId: string): Promise<boolean> {
  const key = `telemetry:rate:${workspaceId}:${Math.floor(Date.now() / 60000)}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 120);
    return count <= 1000; // 1000 events/min per workspace
  } catch {
    return true; // Fail open
  }
}

// ── De-duplication guard (in-process, 5-min TTL) ───────────────────────────

const seenEventIds = new Set<string>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;
let lastDedupClean = Date.now();

function isDuplicate(eventId: string): boolean {
  if (Date.now() - lastDedupClean > DEDUP_WINDOW_MS) {
    seenEventIds.clear();
    lastDedupClean = Date.now();
  }
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.add(eventId);
  return false;
}

export const telemetryRouter = router({
  // ── Ingest (SDK → Server, authenticated via API key) ──────────────────

  ingest: publicProcedure.input(ingestSchema).mutation(async ({ input, ctx }) => {
    const startTime = Date.now();

    const apiKey =
      (ctx.req.headers["x-api-key"] as string) ||
      (ctx.req.headers.authorization as string)?.replace("Bearer ", "");

    if (!apiKey || apiKey.trim().length < 8) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Missing or invalid API key",
      });
    }

    const userId = await resolveWorkspaceByApiKey(apiKey.trim());
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      });
    }

    // Rate limit check
    const allowed = await checkTelemetryRateLimit(input.events[0]?.workspaceId);
    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Telemetry rate limit exceeded (1000/min per workspace)",
      });
    }

    const accepted: string[] = [];
    const rejected: string[] = [];
    const rows: db.InsertAiEventRow[] = [];

    for (const event of input.events) {
      try {
        if (isDuplicate(event.eventId)) {
          accepted.push(event.eventId);
          continue;
        }
        rows.push({
          eventId: event.eventId,
          userId,
          workspaceId: event.workspaceId,
          agentId: event.agentId,
          userHash: event.userId ?? null,
          provider: event.provider,
          model: event.model,
          requestTimestamp: new Date(event.requestTimestamp),
          latencyMs: event.latencyMs,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          cachedTokens: event.cachedTokens,
          costUsd: String(event.costUsd),
          status: event.status,
          redactionCount: event.redactionCount,
          promptHash: event.promptHash,
          responseHash: event.responseHash,
          toolCalls: event.toolCalls,
          metadata: event.metadata,
        });
        accepted.push(event.eventId);
      } catch (err) {
        rejected.push(event.eventId);
        logger.warn({ err, eventId: event.eventId }, "[Telemetry] Event rejected");
      }
    }

    // Enqueue to BullMQ for async processing instead of direct DB insert
    if (rows.length > 0) {
      try {
        await telemetryQueue.add("telemetry", {
          events: rows,
          workspaceId: input.events[0]?.workspaceId ?? "unknown",
        });
      } catch (err) {
        logger.error({ err, count: rows.length }, "[Telemetry] Queue enqueue failed");
        for (const r of rows) {
          const idx = accepted.indexOf(r.eventId);
          if (idx !== -1) {
            accepted.splice(idx, 1);
            rejected.push(r.eventId);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      { accepted: accepted.length, rejected: rejected.length, duration },
      "[Telemetry] Batch enqueued",
    );

    return { accepted: accepted.length, rejected: rejected.length };
  }),

  // ── Events list (for dashboard) ────────────────────────────────────────

  events: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
        provider: z.string().optional(),
        status: z.string().optional(),
        agentId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const result = await db.listAiEvents(ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
        provider: input.provider,
        status: input.status,
        agentId: input.agentId,
      });
      return result;
    }),

  // ── Aggregated stats (for dashboard cards) ─────────────────────────────

  stats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await db.getAiEventStats(ctx.user.id, 30);
    return stats;
  }),
});
