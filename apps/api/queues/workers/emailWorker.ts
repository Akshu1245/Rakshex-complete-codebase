import { Worker, type Job } from "bullmq";
import { redis } from "../../_core/cache";
import { logger } from "../../_core/logger";
import {
  sendScanCompleteEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
} from "../../email";

export interface EmailJobData {
  to: string;
  subject?: string;
  template: "welcome" | "password-reset" | "scan-complete" | "team-invite" | "weekly-digest";
  variables: Record<string, unknown>;
}

function buildWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    "email",
    async (job: Job<EmailJobData>) => {
      const { to, template, variables } = job.data;

      logger.info({ to, template, jobId: job.id }, "[EmailWorker] Sending email");

      switch (template) {
        case "welcome":
          await sendWelcomeEmail({
            toEmail: to,
            userName: String(variables.userName ?? ""),
          });
          break;

        case "password-reset":
          await sendPasswordResetEmail({
            toEmail: to,
            resetUrl: String(variables.resetUrl),
            expiresInHours: Number(variables.expiresInHours ?? 24),
          });
          break;

        case "scan-complete":
          await sendScanCompleteEmail({
            toEmail: to,
            userName: String(variables.userName ?? ""),
            collectionName: String(variables.collectionName ?? ""),
            scanDate: String(variables.scanDate ?? new Date().toISOString()),
            criticalCount: Number(variables.criticalCount ?? 0),
            highCount: Number(variables.highCount ?? 0),
            mediumCount: Number(variables.mediumCount ?? 0),
            lowCount: Number(variables.lowCount ?? 0),
            dashboardUrl: String(variables.dashboardUrl ?? ""),
          });
          break;

        case "team-invite":
          await sendTeamInviteEmail({
            toEmail: to,
            inviterName: String(variables.inviterName ?? ""),
            role: (variables.role as "admin" | "editor" | "viewer") ?? "viewer",
          });
          break;

        case "weekly-digest":
          // Handled by the existing weekly-digest queue
          break;

        default:
          logger.warn({ template }, "[EmailWorker] Unknown email template, skipping");
      }

      logger.info({ to, template, jobId: job.id }, "[EmailWorker] Email sent");
    },
    {
      connection: redis,
      concurrency: 4,
    },
  );

  worker.on("failed", (job, err) => {
    // Email is non-critical — log and move on, don't throw
    logger.warn(
      {
        err,
        to: job?.data?.to,
        template: job?.data?.template,
        attempts: job?.attemptsMade,
      },
      "[EmailWorker] Email delivery failed (non-critical)",
    );
  });

  return worker;
}

let worker: Worker<EmailJobData> | null = null;

export function startEmailWorker(): Worker<EmailJobData> {
  if (worker) return worker;
  worker = buildWorker();
  logger.info("[EmailWorker] Started (concurrency=4)");
  return worker;
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[EmailWorker] Stopped");
  }
}
