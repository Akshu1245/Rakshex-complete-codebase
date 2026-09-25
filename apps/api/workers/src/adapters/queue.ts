/**
 * Workers Queues producer — replaces BullMQ (apps/api/queues.ts).
 *
 * Job types mirror the Express queue names so consumers stay conceptually
 * aligned: receipt-export, webhook-delivery, provider-reconciliation,
 * weekly-digest, plus digest fan-out items.
 */
import type { Env } from "../env";

export type QueueJobType =
  | "receipt-export"
  | "webhook-delivery"
  | "provider-reconciliation"
  | "weekly-digest-fanout"
  | "weekly-digest";

export interface QueueJob {
  type: QueueJobType;
  enqueuedAt: string;
  payload: Record<string, unknown>;
}

export async function enqueueJob(
  env: Env,
  type: QueueJobType,
  payload: Record<string, unknown>,
): Promise<void> {
  const job: QueueJob = { type, enqueuedAt: new Date().toISOString(), payload };
  await env.EVAL_QUEUE.send(job);
}

export const enqueueReceiptExport = (env: Env, workspaceId: number, requestId?: string) =>
  enqueueJob(env, "receipt-export", { workspaceId, ...(requestId ? { requestId } : {}) });

export const enqueueWebhookDelivery = (
  env: Env,
  workspaceId: number,
  event: string,
  payload: Record<string, unknown>,
) => enqueueJob(env, "webhook-delivery", { workspaceId, event, payload });

export const enqueueProviderReconciliation = (env: Env, workspaceId?: number) =>
  enqueueJob(env, "provider-reconciliation", workspaceId ? { workspaceId } : {});

export const enqueueWeeklyDigestFanout = (env: Env) => enqueueJob(env, "weekly-digest-fanout", {});
