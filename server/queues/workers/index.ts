import { logger } from "../../_core/logger";
import { startScanWorker, stopScanWorker } from "./scanWorker";
import { startWebhookWorker, stopWebhookWorker } from "./webhookWorker";
import { startEmailWorker, stopEmailWorker } from "./emailWorker";
import { startTelemetryWorker, stopTelemetryWorker } from "./telemetryWorker";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10) || 3;

logger.info({ concurrency: CONCURRENCY }, "[Workers] Starting worker process");

// Start all workers only if Redis is available
if (process.env.REDIS_URL) {
  startScanWorker();
  startWebhookWorker();
  startEmailWorker();
  startTelemetryWorker();
} else {
  logger.info("[Workers] Running in mock/offline mode — not starting BullMQ workers");
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "[Workers] Shutting down");
  await Promise.all([
    stopScanWorker(),
    stopWebhookWorker(),
    stopEmailWorker(),
    stopTelemetryWorker(),
  ]);
  logger.info("[Workers] All workers stopped");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info("[Workers] Worker process ready");
