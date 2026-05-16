import { logger } from "../../_core/logger";
import { startScanWorker, stopScanWorker } from "./scanWorker";
import { startWebhookWorker, stopWebhookWorker } from "./webhookWorker";
import { startEmailWorker, stopEmailWorker } from "./emailWorker";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10) || 3;

logger.info({ concurrency: CONCURRENCY }, "[Workers] Starting worker process");

// Start all workers
startScanWorker();
startWebhookWorker();
startEmailWorker();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "[Workers] Shutting down");
  await Promise.all([stopScanWorker(), stopWebhookWorker(), stopEmailWorker()]);
  logger.info("[Workers] All workers stopped");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info("[Workers] Worker process ready");
