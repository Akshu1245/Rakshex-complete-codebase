import { Worker, type Job } from "bullmq";
import { redis } from "../../_core/cache";
import { logger } from "../../_core/logger";
import * as db from "../../db";
import type { InsertAiEventRow } from "@rakshex/database";

export interface TelemetryJobData {
  events: InsertAiEventRow[];
  workspaceId: string;
}

function buildWorker(): Worker<TelemetryJobData> {
  const worker = new Worker<TelemetryJobData>(
    "telemetry",
    async (job: Job<TelemetryJobData>) => {
      const { events, workspaceId } = job.data;

      if (events.length === 0) return;

      logger.info({ count: events.length, workspaceId }, "[TelemetryWorker] Processing batch");

      // Batch insert all events into ai_events table
      try {
        await db.insertAiEvents(events);
      } catch (err) {
        logger.error({ err, count: events.length }, "[TelemetryWorker] Batch insert failed");
        throw err;
      }

      // Update workspace token usage counter in Redis
      const today = new Date().toISOString().slice(0, 10);
      let totalTokens = 0;
      let totalCost = 0;

      for (const event of events) {
        totalTokens += (event.inputTokens || 0) + (event.outputTokens || 0);
        totalCost += parseFloat(String(event.costUsd ?? "0"));
      }

      try {
        const pipeline = redis.multi();
        pipeline.incrby(`tokens:${workspaceId}:${today}`, totalTokens);
        pipeline.expire(`tokens:${workspaceId}:${today}`, 60 * 60 * 24 * 2); // 2-day TTL
        pipeline.incrbyfloat(`cost:${workspaceId}:${today}`, totalCost);
        pipeline.expire(`cost:${workspaceId}:${today}`, 60 * 60 * 24 * 2);
        await pipeline.exec();
      } catch (err) {
        logger.warn({ err }, "[TelemetryWorker] Redis counter update failed");
      }

      // Aggregate SDK cost into kill-switch budget so auto-trigger fires on agent spend.
      // Group by user: resolve workspace -> user mapping via workspace API keys.
      if (totalCost > 0 && workspaceId) {
        try {
          const wsId = parseInt(workspaceId, 10);
          if (!isNaN(wsId)) {
            const workspaceRow = await db.getWorkspaceById(wsId);
            if (workspaceRow?.ownerUserId) {
              await db.recordTokenUsage(
                workspaceRow.ownerUserId,
                "sdk_telemetry",
                events.reduce((s, e) => s + (e.inputTokens ?? 0), 0),
                events.reduce((s, e) => s + (e.outputTokens ?? 0), 0),
                0,
                totalCost,
              );
            }
          }
        } catch (spendErr) {
          logger.warn(
            { err: spendErr, workspaceId },
            "[TelemetryWorker] Failed to aggregate spend into budget",
          );
        }
      }

      // Publish to Redis for SSE subscribers
      try {
        const pubData = events.slice(0, 20).map((e) => ({
          eventId: e.eventId,
          provider: e.provider,
          model: e.model,
          costUsd: e.costUsd,
          latencyMs: e.latencyMs,
          status: e.status,
          agentId: e.agentId,
        }));
        await redis.publish(`workspace:${workspaceId}:events`, JSON.stringify(pubData));
      } catch (err) {
        logger.warn({ err }, "[TelemetryWorker] Redis publish failed");
      }
    },
    {
      connection: redis,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { err, jobId: job?.id, workspaceId: job?.data?.workspaceId },
      "[TelemetryWorker] Job failed",
    );
  });

  return worker;
}

let worker: Worker<TelemetryJobData> | null = null;

export function startTelemetryWorker(): Worker<TelemetryJobData> {
  if (worker) return worker;
  worker = buildWorker();
  logger.info("[TelemetryWorker] Started (concurrency=10)");
  return worker;
}

export async function stopTelemetryWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[TelemetryWorker] Stopped");
  }
}
