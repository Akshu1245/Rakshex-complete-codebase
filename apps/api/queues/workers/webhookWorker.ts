import { Worker, type Job } from "bullmq";
import crypto from "crypto";
import { redis } from "../../_core/cache";
import { logger } from "../../_core/logger";

export interface WebhookJobData {
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptCount?: number;
  endpointUrl: string;
  secret: string;
  userId: number;
}

function buildWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    "webhook-delivery",
    async (job: Job<WebhookJobData>) => {
      const { webhookId, eventType, payload, endpointUrl, secret, userId } = job.data;
      const attempt = job.attemptsMade + 1;

      logger.info(
        { webhookId, eventType, attempt, endpointUrl },
        "[WebhookWorker] Delivering webhook",
      );

      // Idempotency: skip if already delivered at this attempt level
      // (BullMQ handles retry deduplication at the queue level)

      const body = JSON.stringify({
        id: webhookId,
        event: eventType,
        createdAt: new Date().toISOString(),
        data: payload,
      });

      // HMAC-SHA256 signature
      const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

      const url = new URL(endpointUrl);
      const isHttps = url.protocol === "https:";
      const transport = isHttps ? await import("https") : await import("http");

      const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = transport.request(
          endpointUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Rakshex-Signature-256": `sha256=${signature}`,
              "X-Rakshex-Event": eventType,
              "X-Rakshex-Delivery": webhookId,
            },
            timeout: 10_000,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk: Buffer) => (data += chunk.toString()));
            res.on("end", () => {
              resolve({ status: res.statusCode ?? 0, body: data });
            });
          },
        );

        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Request timeout"));
        });

        req.write(body);
        req.end();
      });

      if (result.status < 200 || result.status >= 300) {
        throw new Error(
          `Webhook delivery failed with status ${result.status}: ${result.body.slice(0, 200)}`,
        );
      }

      logger.info(
        { webhookId, eventType, status: result.status, attempt },
        "[WebhookWorker] Delivered successfully",
      );
    },
    {
      connection: redis,
      concurrency: 8,
      limiter: {
        max: 50,
        duration: 60_000, // max 50 deliveries per minute
      },
    },
  );

  worker.on("failed", async (job, err) => {
    logger.error(
      {
        err,
        webhookId: job?.data?.webhookId,
        eventType: job?.data?.eventType,
        attemptsMade: job?.attemptsMade,
      },
      "[WebhookWorker] Delivery failed permanently",
    );
  });

  return worker;
}

let worker: Worker<WebhookJobData> | null = null;

export function startWebhookWorker(): Worker<WebhookJobData> {
  if (worker) return worker;
  worker = buildWorker();
  logger.info("[WebhookWorker] Started (concurrency=8, rate=50/min)");
  return worker;
}

export async function stopWebhookWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[WebhookWorker] Stopped");
  }
}
