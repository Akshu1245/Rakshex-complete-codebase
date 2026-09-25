/**
 * Metering — the bridge between gateway usage and billing internals.
 *
 * Salvaged from DevPulse `_core/meteringService.ts` (Team D, 2026-09-25).
 * Deliberately small: it writes canonical usage_events rows and answers
 * "how much did this workspace use in this period?" — no second metering
 * store, no provider logic. Provider checkout/entitlement wiring stays with
 * Team A; the signed billing webhook events below give them a neutral
 * seam (`billingEvents.ts`).
 */
import * as db from "../../db";
import { usageEvents } from "@rakshex/database/schema-foundation";
import { eq, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PLAN_CATALOG, computeOverageCents, type PlanId } from "./provider";

export type BillableUnit =
  | "api_calls"
  | "tokens"
  | "bandwidth_gb"
  | "minutes";

export interface BillableEvent {
  // Matches usage_events.workspace_id (integer) in schema-foundation.ts.
  workspaceId: number;
  eventType: BillableUnit;
  quantity: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface PeriodUsage {
  total: number;
  samples: number;
}

/** Record one billable meter tick. Returns the usage_events row id. */
export async function recordBillableEvent(event: BillableEvent): Promise<string> {
  const database = await db.getDb();
  const id = nanoid();
  await database.insert(usageEvents).values({
    id,
    workspaceId: event.workspaceId,
    eventType: event.eventType,
    quantity: String(Math.max(0, Math.floor(event.quantity))),
    unit: event.eventType,
    costUsd: event.costUsd != null ? String(event.costUsd) : null,
    metadata: event.metadata ?? null,
    occurredAt: event.occurredAt ?? new Date(),
  });
  return id;
}

/** Sum of quantity for a workspace + event type inside [periodStart, periodEnd]. */
export async function sumPeriodUsage(input: {
  workspaceId: number;
  eventType: BillableUnit;
  periodStart: Date;
  periodEnd: Date;
}): Promise<PeriodUsage> {
  const database = await db.getDb();
  const rows = await database
    .select({ quantity: usageEvents.quantity })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.workspaceId, input.workspaceId),
        eq(usageEvents.eventType, input.eventType),
        gte(usageEvents.occurredAt, input.periodStart),
        lte(usageEvents.occurredAt, input.periodEnd),
      ),
    );
  let total = 0;
  for (const row of rows) {
    const q = Number(row.quantity);
    if (Number.isFinite(q)) total += q;
  }
  return { total, samples: rows.length };
}

/**
 * Quota check against the plan catalog's usageLimit (requests/month for every
 * catalog plan). Reuses the canonical computeOverageCents — the metering layer
 * reports usage, it does not price it.
 */
export async function checkPlanQuota(input: {
  workspaceId: number;
  planId: PlanId;
  eventType: BillableUnit;
  periodStart: Date;
  periodEnd: Date;
}): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  overageUnits: number;
  overageCents: number;
}> {
  const plan = PLAN_CATALOG[input.planId];
  if (!plan) throw new Error(`Unknown plan id: ${input.planId}`);
  const { total } = await sumPeriodUsage({
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const overageUnits = Math.max(0, total - plan.usageLimit);
  return {
    allowed: total < plan.usageLimit,
    used: total,
    limit: plan.usageLimit,
    overageUnits,
    overageCents: computeOverageCents(input.planId, total),
  };
}
