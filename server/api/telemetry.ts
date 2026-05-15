/**
 * Telemetry Ingest API Router
 *
 * Accepts batched telemetry events from the DevPulse SDK.
 * Validates, de-duplicates, and persists AI call events to the database.
 *
 * Endpoints:
 *   telemetry.ingest  — POST /v2/telemetry/events  (SDK → server)
 *   telemetry.events  — GET telemetry events for dashboard
 *   telemetry.stats   — GET aggregated stats (spend, latency, errors, by-model)
 */

import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { z } from "zod";
import * as db from "../db";

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
  provider: z.enum(["openai","anthropic","bedrock","vertex","cohere","mistral","groq","ollama","vllm"]),
  model: z.string().min(1),
  requestTimestamp: z.string().datetime(),
  latencyMs: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cachedTokens: z.number().int().min(0).default(0),
  costUsd: z.number().min(0),
  status: z.enum(["ok","error","timeout","blocked"]),
  redactionCount: z.number().int().min(0).default(0),
  promptHash: z.string().length(64),
  responseHash: z.string().length(64),
  toolCalls: z.array(toolCallSchema).nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
});

const ingestSchema = z.object({
  events: z.array(telemetryEventSchema).min(1).max(500),
});

// ── De-duplication guard (in-process, 5-min TTL) ───────────────────────────
// Prevents re-ingest of the same eventId within a single process lifetime.
// Cross-process dedup is handled by the unique constraint on eventId in DB.

const seenEventIds = new Set<string>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;
let lastDedupClean = Date.now();

function isDuplicate(eventId: string): boolean {
  // Periodic cleanup of the in-process set to prevent unbounded growth
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

  ingest: publicProcedure
    .input(ingestSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();

      // Authenticate via API key extracted from the request header
      const apiKey = ctx.req.headers["x-api-key"];
      if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Missing x-api-key header",
        });
      }

      const user = await db.getUserByApiKey(apiKey.trim());
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }

      const accepted: string[] = [];
      const rejected: string[] = [];
      const rows: db.InsertAiEventRow[] = [];

      for (const event of input.events) {
        try {
          if (isDuplicate(event.eventId)) {
            accepted.push(event.eventId); // idempotent ack
            continue;
          }
          rows.push({
            eventId: event.eventId,
            userId: user.id,
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

      // Bulk insert in a single query
      if (rows.length > 0) {
        try {
          await db.insertAiEvents(rows);
        } catch (err) {
          logger.error({ err, count: rows.length }, "[Telemetry] Bulk insert failed");
          // Mark all as rejected since we can't partial-insert with the current API
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
        { accepted: accepted.length, rejected: rejected.length, duration, userId: user.id },
        "[Telemetry] Batch ingested"
      );

      return {
        accepted: accepted.length,
        rejected: rejected.length,
        duration,
      };
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
      })
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
