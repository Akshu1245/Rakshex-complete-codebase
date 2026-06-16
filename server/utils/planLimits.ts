/**
 * Centralized plan-limit messaging + structured errors.
 *
 * Inspired by Claude Code's `services/rateLimitMessages.ts` — one source of
 * truth for how plan-limit hits surface to API clients (tRPC) and UI. Every
 * enforcement site throws `new TRPCError` with `cause: PlanLimitCause` so the
 * dashboard and VS Code extension can render a consistent "you've hit X, here's
 * how to fix it" UI instead of parsing free-form strings.
 *
 * Pairs with `computePlanUtilization()` (below) which `payments.getCurrentPlan`
 * returns so UI can show proactive warnings at 70% / 90% — again mirroring
 * Claude Code's `EARLY_WARNING_CONFIGS` (early = when you're burning fast,
 * error = when you actually hit the wall).
 */
import { TRPCError } from "@trpc/server";
import { getPlanLimits, type PlanType } from "../payments";

export type PlanLimitSeverity = "warning" | "error";

export type PlanLimitFeature =
  | "maxCollections"
  | "maxScansPerDay"
  | "shadowAPI"
  | "maxTeamMembers"
  | "killSwitch"
  | "complianceExport";

/**
 * Structured payload attached to `TRPCError.cause` when a plan-limit throw
 * happens. Surfaces everything the client needs to render a useful prompt
 * (title, severity, CTA button + href, reset time when applicable).
 */
export interface PlanLimitCause {
  type: "plan_limit";
  feature: PlanLimitFeature;
  currentPlan: PlanType;
  suggestedPlan: "pro" | "enterprise";
  severity: PlanLimitSeverity;
  title: string;
  description: string;
  upsellCta: {
    label: string;
    href: string;
  };
  /** Current usage (e.g. 3 of 3 scans). Absent for binary feature gates. */
  usage?: {
    used: number;
    limit: number;
    resetsAt?: number; // unix epoch ms
  };
}

const UPSELL_HREF = "/pricing";

function nextPlan(current: PlanType): "pro" | "enterprise" {
  return current === "free" ? "pro" : "enterprise";
}

/**
 * Build a structured plan-limit error. Always results in an HTTP 403
 * (FORBIDDEN) so clients know this is a policy decision, not a bug.
 */
export function planLimitError(cause: Omit<PlanLimitCause, "type">): TRPCError {
  const payload: PlanLimitCause = { type: "plan_limit", ...cause };
  return new TRPCError({
    code: "FORBIDDEN",
    message: payload.description,
    cause: payload,
  });
}

export function collectionLimitError(plan: PlanType, used: number, limit: number): TRPCError {
  const suggested = nextPlan(plan);
  return planLimitError({
    feature: "maxCollections",
    currentPlan: plan,
    suggestedPlan: suggested,
    severity: "error",
    title: "Collection limit reached",
    description: `Your ${plan} plan allows ${limit} collections and you already have ${used}. Upgrade to ${suggested} for unlimited collections.`,
    upsellCta: { label: `Upgrade to ${suggested}`, href: UPSELL_HREF },
    usage: { used, limit },
  });
}

export function scansPerDayLimitError(
  plan: PlanType,
  used: number,
  limit: number,
  resetsAt?: number,
): TRPCError {
  const suggested = nextPlan(plan);
  return planLimitError({
    feature: "maxScansPerDay",
    currentPlan: plan,
    suggestedPlan: suggested,
    severity: "error",
    title: "Daily scan limit reached",
    description: `Your ${plan} plan allows ${limit} scans per day per collection and you've used ${used}. Upgrade to ${suggested} for unlimited scans.`,
    upsellCta: { label: `Upgrade to ${suggested}`, href: UPSELL_HREF },
    usage: { used, limit, resetsAt },
  });
}

export function shadowAPIGatedError(plan: PlanType): TRPCError {
  const suggested = nextPlan(plan);
  return planLimitError({
    feature: "shadowAPI",
    currentPlan: plan,
    suggestedPlan: suggested,
    severity: "error",
    title: "Shadow API detection is a Pro feature",
    description: `Shadow API detection scans are available on ${suggested} and above. Upgrade to unlock.`,
    upsellCta: { label: `Upgrade to ${suggested}`, href: UPSELL_HREF },
  });
}

/**
 * Narrow the cause of an unknown error to a PlanLimitCause, returning null
 * if it isn't one. Safe to use at module boundaries where the error might
 * be anything.
 */
export function getPlanLimitCause(err: unknown): PlanLimitCause | null {
  if (err instanceof TRPCError && err.cause && typeof err.cause === "object") {
    const c = err.cause as unknown as { type?: string };
    if (c.type === "plan_limit") {
      return err.cause as unknown as PlanLimitCause;
    }
  }
  return null;
}

// ============================================================================
// Utilization — for proactive "you're close to your limit" UI
// ============================================================================

export interface UtilizationWindow {
  used: number;
  limit: number | null; // null == unlimited
  pct: number; // 0-100, rounded
  resetsAt?: number; // unix epoch ms, when `used` resets
  status: "ok" | "warning" | "critical"; // <70 / 70-89 / 90+
}

export interface PlanUtilization {
  collections: UtilizationWindow;
  scansPerDay: UtilizationWindow;
  gatewayCallsPerHour?: UtilizationWindow;
  gatewayCallsPerDay?: UtilizationWindow;
  gatewayCallsPerWeek?: UtilizationWindow;
}

function windowStatus(pct: number): UtilizationWindow["status"] {
  if (pct >= 90) return "critical";
  if (pct >= 80) return "warning";
  return "ok";
}

function buildWindow(used: number, rawLimit: number, resetsAt?: number): UtilizationWindow {
  if (!Number.isFinite(rawLimit)) {
    return { used, limit: null, pct: 0, status: "ok", resetsAt };
  }
  const limit = rawLimit;
  const pct = limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  return { used, limit, pct, status: windowStatus(pct), resetsAt };
}

/**
 * Compute the user's current utilization across the dimensions we enforce on.
 * Called from `payments.getCurrentPlan` so every UI that already polls plan
 * data gets utilization for free — no new endpoint required.
 *
 * `dailyScans` = total scans started in the last 24h across all collections.
 * That's slightly looser than the per-collection cap we enforce, but it's the
 * right number for a "daily usage" UI — the critical signal is burn rate, not
 * per-collection distribution.
 */
export function computePlanUtilization(
  plan: PlanType,
  collectionCount: number,
  dailyScanCount: number,
  hourlyGatewayCalls?: number,
  dailyGatewayCalls?: number,
  weeklyGatewayCalls?: number,
): PlanUtilization {
  const limits = getPlanLimits(plan);
  const gwLimits = limits as unknown as {
    maxGatewayCallsPerHour: number;
    maxGatewayCallsPerDay: number;
    maxGatewayCallsPerWeek: number;
  };
  return {
    collections: buildWindow(collectionCount, limits.maxCollections),
    scansPerDay: buildWindow(dailyScanCount, limits.maxScansPerDay),
    gatewayCallsPerHour: buildWindow(hourlyGatewayCalls ?? 0, gwLimits.maxGatewayCallsPerHour ?? 0),
    gatewayCallsPerDay: buildWindow(dailyGatewayCalls ?? 0, gwLimits.maxGatewayCallsPerDay ?? 0),
    gatewayCallsPerWeek: buildWindow(weeklyGatewayCalls ?? 0, gwLimits.maxGatewayCallsPerWeek ?? 0),
  };
}
