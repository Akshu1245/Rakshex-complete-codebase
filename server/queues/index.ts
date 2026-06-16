import { Queue } from "bullmq";
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";

const connection = redis;

class MockQueue {
  private jobs = new Map<string, any>();

  constructor(public name: string) {}

  async add(name: string, data: any, opts?: any): Promise<any> {
    const id = data.scanId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id,
      name,
      data,
      progress: 0,
      attemptsMade: 1,
      getState: async () => "completed",
    };
    this.jobs.set(id, job);

    logger.info({ jobId: id, queueName: this.name }, "[MockQueue] Job added");

    if (this.name === "scan") {
      setTimeout(async () => {
        try {
          const { runCollectionScan } = await import("../services/scanService");
          const { wsManager } = await import("../websocket");

          logger.info({ id, data }, "[MockQueue] Running mock scan job");
          const result = await runCollectionScan(data.userId, data.collectionId, {
            scanType: data.scanType ?? "full",
            triggeredBy: "user",
          });

          try {
            wsManager.broadcastScanComplete(data.userId, {
              scanId: result.scanId,
              collectionId: data.collectionId,
              findingsCount: result.totalFindings,
              criticalCount: result.findings.filter((f) => f.severity === "Critical").length,
              highCount: result.findings.filter((f) => f.severity === "High").length,
            });
          } catch (err) {
            logger.warn({ err }, "[MockQueue] WebSocket broadcast failed");
          }
        } catch (err) {
          logger.error({ err }, "[MockQueue] Failed to execute mock scan");
        }
      }, 500);
    }

    return job;
  }

  async getJob(id: string): Promise<any> {
    return this.jobs.get(id) || null;
  }

  async close(): Promise<void> {}
}

const REDIS_URL = process.env.REDIS_URL;

export const scanQueue = REDIS_URL
  ? new Queue("scan", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    })
  : (new MockQueue("scan") as unknown as Queue);

export const webhookQueue = REDIS_URL
  ? new Queue("webhook-delivery", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    })
  : (new MockQueue("webhook-delivery") as unknown as Queue);

export const emailQueue = REDIS_URL
  ? new Queue("email", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
      },
    })
  : (new MockQueue("email") as unknown as Queue);

export const telemetryQueue = REDIS_URL
  ? new Queue("telemetry", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 500 },
      },
    })
  : (new MockQueue("telemetry") as unknown as Queue);

logger.info(
  REDIS_URL ? "[Queues] BullMQ queues initialized" : "[Queues] Mock in-memory queues initialized",
);

export async function closeQueues(): Promise<void> {
  await Promise.all([
    scanQueue.close(),
    webhookQueue.close(),
    emailQueue.close(),
    telemetryQueue.close(),
  ]);
  logger.info("[Queues] All queues closed");
}
