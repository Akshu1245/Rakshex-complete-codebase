/**
 * Drop-in job-queue abstraction.
 *
 * Two backends:
 *   - "memory": in-process FIFO (default) — appropriate for small deployments
 *     and tests. No durability, no horizontal scaling.
 *   - "bullmq": Redis-backed BullMQ (selected automatically when REDIS_URL is
 *     set). Durable, retryable, horizontally scalable.
 *
 * The same `enqueue(name, data)` API works for both; callers don't care which
 * backend is in use. Workers are registered once at startup with `registerWorker`.
 */
import { logger } from "../_core/logger";
import crypto from "crypto";

type JobHandler<T> = (data: T) => Promise<void>;

interface JobEnvelope<T = unknown> {
  id: string;
  queueName: string;
  data: T;
  attempts: number;
  maxAttempts: number;
}

export interface JobQueue {
  registerWorker<T>(
    queueName: string,
    handler: JobHandler<T>,
    options?: { concurrency?: number; maxAttempts?: number },
  ): void;
  enqueue<T>(queueName: string, data: T, opts?: { delayMs?: number }): Promise<string>;
  shutdown(): Promise<void>;
}

class MemoryJobQueue implements JobQueue {
  private workers: Map<
    string,
    {
      handler: JobHandler<unknown>;
      concurrency: number;
      maxAttempts: number;
      running: number;
      backlog: JobEnvelope[];
    }
  > = new Map();

  registerWorker<T>(
    queueName: string,
    handler: JobHandler<T>,
    options?: { concurrency?: number; maxAttempts?: number },
  ): void {
    if (this.workers.has(queueName)) {
      logger.warn({ queueName }, "[JobQueue] worker already registered, replacing");
    }
    this.workers.set(queueName, {
      handler: handler as JobHandler<unknown>,
      concurrency: Math.max(1, options?.concurrency ?? 4),
      maxAttempts: Math.max(1, options?.maxAttempts ?? 3),
      running: 0,
      backlog: [],
    });
  }

  async enqueue<T>(queueName: string, data: T, opts?: { delayMs?: number }): Promise<string> {
    const id = `${queueName}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const env: JobEnvelope<T> = {
      id,
      queueName,
      data,
      attempts: 0,
      maxAttempts: this.workers.get(queueName)?.maxAttempts ?? 3,
    };
    const delay = Math.max(0, opts?.delayMs ?? 0);
    const dispatch = () => {
      const worker = this.workers.get(queueName);
      if (!worker) {
        logger.warn({ queueName, jobId: id }, "[JobQueue] no worker registered, dropping");
        return;
      }
      worker.backlog.push(env as JobEnvelope);
      this.drainOne(queueName);
    };
    if (delay === 0) {
      // Run on next microtask so callers can `await` enqueue without
      // re-entering the worker synchronously.
      setImmediate(dispatch);
    } else {
      setTimeout(dispatch, delay);
    }
    return id;
  }

  private drainOne(queueName: string): void {
    const worker = this.workers.get(queueName);
    if (!worker) return;
    while (worker.running < worker.concurrency && worker.backlog.length > 0) {
      const env = worker.backlog.shift();
      if (!env) break;
      worker.running += 1;
      void this.runJob(env, worker.handler).finally(() => {
        worker.running -= 1;
        // Continue draining.
        if (worker.backlog.length > 0) this.drainOne(queueName);
      });
    }
  }

  private async runJob(env: JobEnvelope, handler: JobHandler<unknown>): Promise<void> {
    env.attempts += 1;
    try {
      await handler(env.data);
    } catch (err) {
      logger.error(
        { err, queueName: env.queueName, jobId: env.id, attempt: env.attempts },
        "[JobQueue] job failed",
      );
      if (env.attempts < env.maxAttempts) {
        // Re-queue with exponential backoff (capped at 60s).
        const backoff = Math.min(60_000, 1_000 * 2 ** (env.attempts - 1));
        setTimeout(() => {
          const worker = this.workers.get(env.queueName);
          if (worker) {
            worker.backlog.push(env);
            this.drainOne(env.queueName);
          }
        }, backoff);
      } else {
        logger.error(
          { queueName: env.queueName, jobId: env.id },
          "[JobQueue] job exhausted retries, dropping",
        );
      }
    }
  }

  async shutdown(): Promise<void> {
    this.workers.clear();
  }
}

let queue: JobQueue | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialise the job queue (async, called once at server startup).
 * Must be awaited before any enqueue() calls.
 */
export async function initJobQueue(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const redisUrl = process.env.REDIS_URL ?? process.env.RAKSHEX_REDIS_URL;
    if (redisUrl) {
      try {
        queue = await createBullMQQueue(redisUrl);
        logger.info(
          { backend: "bullmq", redisUrl: redisUrl.replace(/:[^@/]*@/, ":***@") },
          "[JobQueue] using BullMQ backend",
        );
        return;
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "[JobQueue] BullMQ failed, falling back to in-memory",
        );
      }
    }
    queue = new MemoryJobQueue();
    logger.info({ backend: "memory" }, "[JobQueue] using in-memory backend");
  })();
  return initPromise;
}

/** Synchronous accessor — initJobQueue() must be called first at startup. */
export function getJobQueue(): JobQueue {
  if (!queue) {
    // Fallback: auto-init with memory queue if startup forgot to call initJobQueue()
    queue = new MemoryJobQueue();
    logger.warn("[JobQueue] getJobQueue called before initJobQueue — using memory fallback");
  }
  return queue;
}

async function createBullMQQueue(redisUrl: string): Promise<JobQueue> {
  // Dynamic import for ESM compatibility (compiled output is ES modules, require() is undefined).
  const { Queue, Worker } = await import("bullmq");
  const queues = new Map<string, import("bullmq").Queue>();
  const workers = new Map<string, import("bullmq").Worker>();

  const connection = redisUrl.startsWith("redis://") ? { url: redisUrl } : { host: redisUrl };

  function getOrCreateQueue(name: string): import("bullmq").Queue {
    let q = queues.get(name);
    if (!q) {
      q = new Queue(name, { connection });
      queues.set(name, q);
    }
    return q;
  }

  return {
    registerWorker(queueName, handler, options) {
      const concurrency = Math.max(1, options?.concurrency ?? 4);
      // Ensure the queue exists so the worker can attach.
      getOrCreateQueue(queueName);
      const worker = new Worker(
        queueName,
        async (job) => {
          await handler(job.data);
        },
        { connection, concurrency },
      );
      worker.on("failed", (job, err) => {
        logger.error(
          { err, queueName, jobId: job?.id, attempt: job?.attemptsMade },
          "[JobQueue] BullMQ job failed",
        );
      });
      workers.set(queueName, worker);
    },
    async enqueue(queueName, data, opts) {
      const q = getOrCreateQueue(queueName);
      const job = await q.add(queueName, data, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1_000 },
        ...(opts?.delayMs ? { delay: opts.delayMs } : {}),
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      });
      return String(job.id);
    },
    async shutdown() {
      for (const w of Array.from(workers.values())) await w.close();
      for (const q of Array.from(queues.values())) await q.close();
      workers.clear();
      queues.clear();
    },
  };
}
