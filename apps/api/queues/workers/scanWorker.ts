import { Worker, type Job } from "bullmq";
import { invalidateUserCache, redis } from "../../_core/cache";
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { runCollectionScan, type ScanOptions } from "../../services/scanService";
import { wsManager } from "../../websocket";

export interface ScanJobData {
  scanId?: string;
  userId: number;
  collectionId: string;
  engineType?: "owasp" | "agentguard" | "full";
  /** Flat shape used by `scanning.startScan` → scanQueue.add */
  scanType?: "full" | "quick" | "shadow_api" | "prompt_injection";
  workspaceId?: number;
  /**
   * Nested shape used by `enqueueScan` / GitHub webhooks via jobs.ts.
   * Accept both so whichever BullMQ consumer picks up the shared `scan`
   * queue never crashes on `options.scanType` being undefined.
   */
  options?: ScanOptions;
  triggeredBy?: ScanOptions["triggeredBy"];
  prNumber?: number;
  branch?: string;
  commitSha?: string;
}

function resolveScanOptions(data: ScanJobData): ScanOptions {
  if (data.options?.scanType) {
    return data.options;
  }
  return {
    scanType: data.scanType ?? "full",
    triggeredBy: data.triggeredBy ?? data.options?.triggeredBy ?? "user",
    prNumber: data.prNumber ?? data.options?.prNumber,
    branch: data.branch ?? data.options?.branch,
    commitSha: data.commitSha ?? data.options?.commitSha,
  };
}

/** Exported for unit tests — dual job-shape contract with jobs.ts. */
export { resolveScanOptions };

function buildWorker(): Worker<ScanJobData> {
  const worker = new Worker<ScanJobData>(
    "scan",
    async (job: Job<ScanJobData>) => {
      const { userId, collectionId } = job.data;
      const options = resolveScanOptions(job.data);

      logger.info(
        { jobId: job.id, userId, collectionId, scanType: options.scanType },
        "[ScanWorker] Processing scan job",
      );

      // Progress for UI polling (idempotent retries re-run scan with same inputs)
      await job.updateProgress(10);
      const result = await runCollectionScan(userId, collectionId, options);
      await job.updateProgress(100);

      // Broadcast completion via WebSocket + drop stale dashboard/collection caches
      try {
        await invalidateUserCache(userId);
        wsManager.broadcastScanComplete(userId, {
          scanId: result.scanId,
          collectionId,
          findingsCount: result.totalFindings,
          criticalCount: result.findings.filter((f) => f.severity === "Critical").length,
          highCount: result.findings.filter((f) => f.severity === "High").length,
        });
      } catch (err) {
        logger.warn({ err }, "[ScanWorker] WebSocket broadcast failed");
      }

      return result;
    },
    {
      connection: redis,
      concurrency: 3,
    },
  );

  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, collectionId: job.data.collectionId },
      "[ScanWorker] Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      { err, jobId: job?.id, collectionId: job?.data?.collectionId },
      "[ScanWorker] Job failed",
    );

    if (job?.data.userId) {
      db.createAuditLogEntry(job.data.userId, "scan_failed", {
        collectionId: job.data.collectionId,
        error: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    }
  });

  return worker;
}

let worker: Worker<ScanJobData> | null = null;

export function startScanWorker(): Worker<ScanJobData> {
  if (worker) return worker;
  worker = buildWorker();
  logger.info("[ScanWorker] Started (concurrency=3)");
  return worker;
}

export async function stopScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[ScanWorker] Stopped");
  }
}
