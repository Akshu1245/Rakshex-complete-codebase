/**
 * Cron triggers — replace node-cron / BullMQ repeatables
 * (apps/api/jobs/weeklyDigest.ts, provider reconciliation in
 * apps/api/api/providerBilling.ts + services/billing/openAiBillingReconciliation).
 *
 * Handlers only FAN OUT to the queue; the queue consumer does the work, so a
 * slow provider API or SMTP server can never freeze the cron tick.
 */
import type { Env } from "./env";
import { enqueueProviderReconciliation, enqueueWeeklyDigestFanout } from "./adapters/queue";

export async function handleScheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  switch (event.cron) {
    case "*/15 * * * *":
      // Provider reconciliation: fetch provider Costs & Usage rows and match
      // them against gateway-attributed spend (see
      // services/billing/openAiBillingReconciliation.ts — ported as a queue
      // consumer job in index.ts).
      ctx.waitUntil(enqueueProviderReconciliation(env));
      break;
    case "0 9 * * 1":
      // Weekly digest: fan out one digest job per user (mirrors
      // runWeeklyDigest() in apps/api/jobs/weeklyDigest.ts).
      ctx.waitUntil(enqueueWeeklyDigestFanout(env));
      break;
    default:
      console.warn(`[scheduled] unknown cron "${event.cron}" — ignored`);
  }
}
