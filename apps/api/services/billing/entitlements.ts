/**
 * Apply paid-plan changes to workspace_entitlements.
 * Frontend never assigns plans — only webhook/server-side paths call this.
 */
import * as db from "../../db";
import { upsertWorkspaceEntitlement } from "../../db/workspaceSeats";
import { logger } from "../../_core/logger";
import { PLAN_CATALOG, type PlanId } from "./provider";

export type BillablePlan = "free" | "pro" | "enterprise";

export function includedSeatsForPlan(plan: BillablePlan): number {
  const catalogPlan: PlanId = plan;
  return PLAN_CATALOG[catalogPlan]?.seatsIncluded ?? 1;
}

export function normalizeBillablePlan(raw: unknown): BillablePlan {
  if (raw === "pro" || raw === "enterprise" || raw === "free") return raw;
  return "pro";
}

/**
 * Prefer explicit workspaceId from checkout notes/metadata; otherwise the
 * caller's oldest owned workspace (personal or team).
 */
export async function resolveBillingWorkspaceId(opts: {
  userId: number;
  workspaceId?: number | string | null;
}): Promise<number | null> {
  const parsed =
    opts.workspaceId == null || opts.workspaceId === ""
      ? NaN
      : typeof opts.workspaceId === "number"
        ? opts.workspaceId
        : Number.parseInt(String(opts.workspaceId), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    const membership = await db.getWorkspaceMembership(parsed, opts.userId);
    if (membership?.active) return parsed;
    logger.warn(
      { userId: opts.userId, workspaceId: parsed },
      "[Billing] Ignoring workspaceId not owned/joined by payer",
    );
  }

  const workspaces = await db.listWorkspacesForUser(opts.userId);
  const owned = workspaces.find((w) => w.ownerUserId === opts.userId || w.role === "owner");
  return owned?.id ?? workspaces[0]?.id ?? null;
}

export async function applyPlanEntitlement(input: {
  userId: number;
  plan: BillablePlan;
  status?: string;
  workspaceId?: number | string | null;
  billingProvider?: string;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  graceExpiresAt?: Date | null;
}): Promise<{ workspaceId: number | null }> {
  await db.updateUserPlan(input.userId, input.plan);

  const workspaceId = await resolveBillingWorkspaceId({
    userId: input.userId,
    workspaceId: input.workspaceId,
  });
  if (!workspaceId) {
    logger.warn(
      { userId: input.userId, plan: input.plan },
      "[Billing] Plan updated on user but no workspace found for entitlement",
    );
    return { workspaceId: null };
  }

  await upsertWorkspaceEntitlement({
    workspaceId,
    plan: input.plan,
    status: input.status ?? (input.plan === "free" ? "canceled" : "active"),
    includedSeats: includedSeatsForPlan(input.plan),
    purchasedSeats: 0,
    billingProvider: input.billingProvider ?? null,
    billingCustomerId: input.billingCustomerId ?? null,
    billingSubscriptionId: input.billingSubscriptionId ?? null,
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    graceExpiresAt: input.graceExpiresAt ?? null,
  });

  logger.info(
    { userId: input.userId, workspaceId, plan: input.plan, status: input.status },
    "[Billing] Workspace entitlement upserted",
  );
  return { workspaceId };
}
