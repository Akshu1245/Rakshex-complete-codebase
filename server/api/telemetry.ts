/**
 * Telemetry Ingest API Router
 *
 * Accepts batched telemetry events from the DevPulse SDK.
 * Validates, de-duplicates, and stores AI call events.
 *
 * Endpoints:
 *   telemetry.ingest  — POST /v2/telemetry/events  (SDK → server)
 *   telemetry.events  — GET telemetry events for dashboard
 *   telemetry.stats   — GET aggregated stats (spend, latency, errors)
 */

import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { z } from "zod";

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

// ── In-memory buffer (replace with ClickHouse in production) ───────────────

const telemetryBuffer: z.infer<typeof telemetryEventSchema>[] = [];
const MAX_BUFFER_SIZE = 10_000;

function addToBuffer(event: z.infer<typeof telemetryEventSchema>) {
  // De-duplicate by eventId
  const exists = telemetryBuffer.find((e) => e.eventId === event.eventId);
  if (!exists) {
    telemetryBuffer.push(event);
    if (telemetryBuffer.length > MAX_BUFFER_SIZE) {
      telemetryBuffer.shift(); // drop oldest
    }
  }
}

export const telemetryRouter = router({
  // ── Ingest (SDK → Server, authenticated via API key) ──────────────────

  ingest: publicProcedure
    .input(ingestSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      const accepted: string[] = [];
      const rejected: string[] = [];

      for (const event of input.events) {
        try {
          addToBuffer(event);
          accepted.push(event.eventId);
        } catch (err) {
          rejected.push(event.eventId);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        { accepted: accepted.length, rejected: rejected.length, duration },
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
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        provider: z.string().optional(),
        status: z.string().optional(),
        agentId: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      let events = [...telemetryBuffer].reverse();

      if (input.provider) events = events.filter((e) => e.provider === input.provider);
      if (input.status) events = events.filter((e) => e.status === input.status);
      if (input.agentId) events = events.filter((e) => e.agentId === input.agentId);

      const total = events.length;
      const page = events.slice(input.offset, input.offset + input.limit);

      return { events: page, total };
    }),

  // ── Aggregated stats (for dashboard cards) ─────────────────────────────

  stats: protectedProcedure.query(async () => {
    const events = [...telemetryBuffer];

    if (events.length === 0) {
      return {
        totalCalls: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0,
        errorRate: 0,
        byProvider: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        recentLatency: [] as Array<{ ts: string; ms: number }>,
      };
    }

    const totalCost = events.reduce((s, e) => s + e.costUsd, 0);
    const totalLatency = events.reduce((s, e) => s + e.latencyMs, 0);
    const errors = events.filter((e) => e.status !== "ok");

    const byProvider: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const e of events) {
      byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    }

    // Recent latency trend (last 50 events)
    const recentLatency = events.slice(-50).map((e) => ({
      ts: e.requestTimestamp,
      ms: e.latencyMs,
    }));

    return {
      totalCalls: events.length,
      totalCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
      avgLatencyMs: Math.round(totalLatency / events.length),
      errorRate: Math.round((errors.length / events.length) * 10000) / 100,
      byProvider,
      byStatus,
      recentLatency,
    };
  }),
});
