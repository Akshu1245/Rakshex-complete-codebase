import cron from "node-cron";
import * as db from "../db";
import { logger } from "../_core/logger";
import { enqueueWeeklyDigest } from "../services/jobs";

/**
 * Fan out one digest job per user via the job queue. Per-user processing
 * (DB reads + SMTP send) happens concurrently inside the queue worker
 * pool so a slow SMTP server can no longer freeze the whole digest run.
 */
export async function runWeeklyDigest(): Promise<void> {
  logger.info("[WeeklyDigest] Starting weekly digest fan-out...");

  try {
    const users = await db.getAllUsers();
    logger.info(`[WeeklyDigest] Enqueueing digest jobs for ${users.length} users`);

    let enqueued = 0;
    for (const user of users) {
      if (!user.email) continue;
      try {
        await enqueueWeeklyDigest({ userId: user.id });
        enqueued += 1;
      } catch (err) {
        logger.error({ err, userId: user.id }, "[WeeklyDigest] Failed to enqueue digest job");
      }
    }
    logger.info(`[WeeklyDigest] Fan-out complete: ${enqueued} jobs enqueued`);
  } catch (error) {
    logger.error({ err: error }, "[WeeklyDigest] Error running weekly digest");
  }
}

export function scheduleWeeklyDigest(): void {
  const cronExpression = process.env.WEEKLY_DIGEST_CRON || "0 9 * * 1";

  if (!cron.validate(cronExpression)) {
    logger.warn(`[WeeklyDigest] Invalid cron expression "${cronExpression}", skipping schedule`);
    return;
  }

  logger.info(`[WeeklyDigest] Scheduling weekly digest for ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    await runWeeklyDigest();
  });

  logger.info("[WeeklyDigest] Weekly digest scheduled successfully");
}
