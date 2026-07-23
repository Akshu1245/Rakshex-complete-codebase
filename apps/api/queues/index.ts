import { Queue } from "bullmq";
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";

const connection = redis;

class MockQueue {
  private jobs = new Map<string, any>();

  constructor(public name: string) {}

  async add(name: string, data: any, opts?: any): Promise<any> {
    const id =
      data.scanId ||
      data.prNumber ||
      `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id,
      name,
      data,
      progress: 0,
      attemptsMade: 1,
      getState: async () => "completed",
    };
    this.jobs.set(id, job);

    logger.info({ jobId: id, queueName: this.name, jobName: name }, "[MockQueue] Job added");

    if (name === "scan" || this.name === "scan") {
      setTimeout(async () => {
        try {
          const { runCollectionScan } = await import("../services/scanService");
          const { wsManager } = await import("../websocket");

          logger.info({ id, data }, "[MockQueue] Running mock scan job");
          // Accept both flat `{ scanType }` and nested `{ options }` job shapes
          // (same contract as scanWorker / jobs.ts registerWorker).
          const options = data.options?.scanType
            ? data.options
            : {
                scanType: data.scanType ?? data.options?.scanType ?? "full",
                triggeredBy: data.triggeredBy ?? data.options?.triggeredBy ?? "user",
                prNumber: data.prNumber ?? data.options?.prNumber,
                branch: data.branch ?? data.options?.branch,
                commitSha: data.commitSha ?? data.options?.commitSha,
              };
          const result = await runCollectionScan(data.userId, data.collectionId, options);

          try {
            wsManager.broadcastScanComplete(data.userId, {
              scanId: result.scanId,
              collectionId: data.collectionId,
              findingsCount: result.totalFindings,
              criticalCount: result.findings.filter((f: any) => f.severity === "Critical").length,
              highCount: result.findings.filter((f: any) => f.severity === "High").length,
            });
          } catch (err) {
            logger.warn({ err }, "[MockQueue] WebSocket broadcast failed");
          }
        } catch (err) {
          logger.error({ err }, "[MockQueue] Failed to execute mock scan");
        }
      }, 500);
    }

    if (name === "pr-scan" || this.name === "pr-scan") {
      setTimeout(async () => {
        try {
          const { processPrScanJob } = await import("./workers/prScanWorker");
          logger.info({ id, data }, "[MockQueue] Running mock pr-scan job (simulated)");
          const mockJob = { data, id } as any;
          await processPrScanJob(mockJob);
        } catch (err) {
          logger.error({ err }, "[MockQueue] Failed to execute mock pr-scan");
        }
      }, 300);
    }

    return job;
  }

  async getJob(id: string): Promise<any> {
    return this.jobs.get(id) || null;
  }

  async close(): Promise<void> {}
}

const isProduction = process.env.NODE_ENV === "production";
const REDIS_URL = process.env.REDIS_URL;

if (isProduction && !REDIS_URL) {
  throw new Error(
    "REDIS_URL is required in production — refusing to start with mock BullMQ queues",
  );
}

function createQueue(
  name: string,
  opts: { attempts: number; delay: number; keepComplete: number; keepFail: number },
) {
  if (!REDIS_URL) {
    return new MockQueue(name) as unknown as Queue;
  }
  return new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: opts.attempts,
      backoff: { type: "exponential", delay: opts.delay },
      removeOnComplete: { count: opts.keepComplete },
      removeOnFail: { count: opts.keepFail },
    },
  });
}

export const scanQueue = createQueue("scan", {
  attempts: 3,
  delay: 1000,
  keepComplete: 500,
  keepFail: 500,
});

export const prScanQueue = createQueue("pr-scan", {
  attempts: 3,
  delay: 1000,
  keepComplete: 500,
  keepFail: 500,
});

export const webhookQueue = createQueue("webhook-delivery", {
  attempts: 5,
  delay: 1000,
  keepComplete: 500,
  keepFail: 500,
});

export const emailQueue = createQueue("email", {
  attempts: 3,
  delay: 2000,
  keepComplete: 200,
  keepFail: 200,
});

export const telemetryQueue = createQueue("telemetry", {
  attempts: 3,
  delay: 500,
  keepComplete: 5000,
  keepFail: 500,
});

logger.info(
  REDIS_URL
    ? "[Queues] BullMQ queues initialized"
    : "[Queues] Mock in-memory queues initialized (development/test only)",
);

export async function closeQueues(): Promise<void> {
  await Promise.all([
    scanQueue.close(),
    prScanQueue.close(),
    webhookQueue.close(),
    emailQueue.close(),
    telemetryQueue.close(),
  ]);
  logger.info("[Queues] All queues closed");
}
