/**
 * Typed job-queue wrappers.
 *
 * Centralises every queue name, payload schema, and worker registration so
 * the rest of the codebase only sees small `enqueueX()` helpers and never
 * touches the underlying `JobQueue` instance directly.
 *
 * Queues:
 *   - `scan` — runs `runCollectionScan(userId, collectionId, options)`. Used
 *     by the GitHub webhook handler so push / PR events do not block the
 *     webhook response on a multi-second scan.
 *   - `webhook-delivery` — posts a `WebhookEvent` to all of a user's
 *     registered endpoints. Used by every internal `deliverAsync()` call.
 *   - `weekly-digest` — sends one weekly digest email per user. The cron
 *     job enqueues N jobs (one per user) and the workers fan out so a slow
 *     SMTP server can no longer freeze the whole digest run.
 *
 * Worker registration is idempotent — calling `registerJobWorkers()` more
 * than once is a no-op (the underlying queue logs a warning and replaces
 * the handler, but our flag prevents double-registration in normal flows).
 */
import { logger } from "../_core/logger";
import { getJobQueue } from "./jobQueue";
import { type ScanOptions, runCollectionScan } from "./scanService";
import {
  deliver,
  retryWebhookDelivery,
  type WebhookEvent,
  type WebhookRetryJob,
} from "./webhookDelivery";
import { sendWeeklyDigestEmail } from "../email";
import * as db from "../db";

export const QUEUE_SCAN = "scan" as const;
export const QUEUE_WEBHOOK_DELIVERY = "webhook-delivery" as const;
export const QUEUE_WEBHOOK_RETRY = "webhook_retry" as const;
export const QUEUE_WEEKLY_DIGEST = "weekly-digest" as const;
export const QUEUE_AZURE_DISCOVERY = "azure-discovery" as const;
export const QUEUE_COPILOT_SYNC = "copilot-sync" as const;

export interface ScanJob {
  userId: number;
  collectionId: string;
  options: ScanOptions;
}

export interface WebhookDeliveryJob {
  userId: number;
  event: WebhookEvent;
  data: Record<string, unknown>;
}

export interface WeeklyDigestJob {
  userId: number;
}

let registered = false;

/**
 * Register all background workers. Safe to call multiple times — only the
 * first call attaches handlers; subsequent calls are no-ops.
 *
 * Tests can pass `{ force: true }` to override an existing registration —
 * this is the only legitimate use case.
 */
export function registerJobWorkers(opts?: { force?: boolean }): void {
  if (registered && !opts?.force) return;
  registered = true;
  const q = getJobQueue();

  q.registerWorker<ScanJob>(
    QUEUE_SCAN,
    async (data) => {
      logger.info(
        {
          queue: QUEUE_SCAN,
          userId: data.userId,
          collectionId: data.collectionId,
          scanType: data.options.scanType,
          triggeredBy: data.options.triggeredBy,
        },
        "[Jobs] running queued scan",
      );
      await runCollectionScan(data.userId, data.collectionId, data.options);
    },
    { concurrency: 4, maxAttempts: 3 },
  );

  q.registerWorker<WebhookDeliveryJob>(
    QUEUE_WEBHOOK_DELIVERY,
    async (data) => {
      await deliver(data.userId, data.event, data.data);
    },
    { concurrency: 8, maxAttempts: 5 },
  );

  q.registerWorker<WebhookRetryJob>(
    QUEUE_WEBHOOK_RETRY,
    async (data) => {
      await retryWebhookDelivery(data);
    },
    { concurrency: 4, maxAttempts: 1 },
  );

  q.registerWorker<WeeklyDigestJob>(
    QUEUE_WEEKLY_DIGEST,
    async (data) => {
      const user = await db.getUserById(data.userId);
      if (!user?.email) return;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const scans = await db.getRecentScans(user.id, 7);
      const recent = scans.filter((s) => new Date(s.createdAt) >= oneWeekAgo);
      let totalFindings = 0;
      let criticalFindings = 0;
      for (const scan of recent) {
        const findings = await db.getFindingsByScanId(scan.id);
        totalFindings += findings.length;
        criticalFindings += findings.filter((f) => f.severity === "Critical").length;
      }
      const collections = await db.getCollectionsByUserId(user.id);
      const appUrl = process.env.APP_URL || "https://rakshex.in";
      await sendWeeklyDigestEmail({
        toEmail: user.email,
        userName: user.name || "",
        weeklyScans: recent.length,
        newFindings: totalFindings,
        criticalFindings,
        totalCost: 0,
        topCollection: collections[0]?.name || "N/A",
        dashboardUrl: `${appUrl}/dashboard`,
      });
    },
    { concurrency: 4, maxAttempts: 3 },
  );

  // ─── Rakshex Enterprise Workers ────────────────────────────────────
  q.registerWorker(
    QUEUE_AZURE_DISCOVERY,
    async (data: {
      workspaceId: number;
      connectionId: number;
      tenantId: string;
      subscriptionId: string;
    }) => {
      const { runAzureDiscovery } = await import("./discovery/orchestrator");
      await runAzureDiscovery(data);
    },
    { concurrency: 2, maxAttempts: 2 },
  );

  q.registerWorker(
    QUEUE_COPILOT_SYNC,
    async (data: { workspaceId: number; orgName: string; token: string }) => {
      const { syncCopilotMetrics } = await import("./copilot/copilotMetrics");
      await syncCopilotMetrics(data.workspaceId, data.orgName, data.token);
    },
    { concurrency: 2, maxAttempts: 2 },
  );

  logger.info(
    {
      queues: [
        QUEUE_SCAN,
        QUEUE_WEBHOOK_DELIVERY,
        QUEUE_WEBHOOK_RETRY,
        QUEUE_WEEKLY_DIGEST,
        QUEUE_AZURE_DISCOVERY,
        QUEUE_COPILOT_SYNC,
      ],
    },
    "[Jobs] background workers registered",
  );
}

/** Enqueue a collection scan. Returns the underlying job id. */
export async function enqueueScan(job: ScanJob): Promise<string> {
  return getJobQueue().enqueue(QUEUE_SCAN, job);
}

/**
 * Enqueue a webhook delivery. Use this from hot request paths instead of
 * `deliver()` directly so the request response time does not depend on
 * the receiver's response time.
 */
export async function enqueueWebhookDelivery(job: WebhookDeliveryJob): Promise<string> {
  return getJobQueue().enqueue(QUEUE_WEBHOOK_DELIVERY, job);
}

/** Enqueue a per-user weekly digest. Used by the cron job. */
export async function enqueueWeeklyDigest(job: WeeklyDigestJob): Promise<string> {
  return getJobQueue().enqueue(QUEUE_WEEKLY_DIGEST, job);
}

/**
 * Reset registration state — for tests only. Production code never needs
 * this and should not call it.
 */
export function _resetJobsRegistrationForTests(): void {
  registered = false;
}
