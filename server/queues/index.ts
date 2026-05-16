import { Queue } from "bullmq";
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";

const connection = redis;

export const scanQueue = new Queue("scan", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

export const webhookQueue = new Queue("webhook-delivery", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

export const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

export const telemetryQueue = new Queue("telemetry", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 500 },
  },
});

logger.info("[Queues] BullMQ queues initialized");

/**
 * Gracefully close all queues. Call this on process shutdown.
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([scanQueue.close(), webhookQueue.close(), emailQueue.close(), telemetryQueue.close()]);
  logger.info("[Queues] All queues closed");
}
