export type AllocationMode = "locked" | "shareable" | "pooled";
export type CapacityPriority = "experimental" | "normal" | "customer" | "critical";
export type CapacitySourceType =
  | "personal"
  | "project"
  | "team_shared"
  | "member_shareable"
  | "emergency_reserve";

export interface CapacitySource {
  id: string;
  type: CapacitySourceType;
  /** Remaining dollars that can be reserved from this source now. */
  availableUsd: number;
  /** For member_shareable sources, the protected amount that must remain untouched. */
  protectedUsd?: number;
  /** Optional owner used for audit evidence only. */
  ownerIdentityId?: number;
  ownerProjectId?: string;
  /** Lower values are consumed first after personal/project allocations. */
  rank?: number;
}

export interface AdaptiveBudgetPolicy {
  mode: AllocationMode;
  /** Maximum borrowed capacity a requester may consume for this decision. */
  maxBorrowUsd: number;
  /** Requests borrowing more than this amount require approval. */
  approvalThresholdUsd: number;
  /** Emergency capacity is only available at or above this priority. */
  emergencyMinPriority: CapacityPriority;
}

export interface CapacityRequest {
  requestId: string;
  amountUsd: number;
  priority: CapacityPriority;
  identityId?: number;
  projectId?: string;
  allowBorrow?: boolean;
  allowEmergency?: boolean;
}

export interface CapacityReservationSlice {
  sourceId: string;
  sourceType: CapacitySourceType;
  amountUsd: number;
  ownerIdentityId?: number;
  ownerProjectId?: string;
}

export interface CapacityPlan {
  requestId: string;
  allowed: boolean;
  requestedUsd: number;
  reservedUsd: number;
  shortfallUsd: number;
  borrowedUsd: number;
  requiresApproval: boolean;
  slices: CapacityReservationSlice[];
  reasons: string[];
}

const PRIORITY_ORDER: Record<CapacityPriority, number> = {
  experimental: 0,
  normal: 1,
  customer: 2,
  critical: 3,
};

function money(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 1_000_000) / 1_000_000);
}

function canUseEmergency(
  priority: CapacityPriority,
  minPriority: CapacityPriority,
): boolean {
  return PRIORITY_ORDER[priority] >= PRIORITY_ORDER[minPriority];
}

function sourcePriority(source: CapacitySource): number {
  switch (source.type) {
    case "personal":
      return 0;
    case "project":
      return 1;
    case "team_shared":
      return 2;
    case "member_shareable":
      return 3;
    case "emergency_reserve":
      return 4;
  }
}

/**
 * Produce a deterministic capacity plan. This function never mutates balances and
 * never claims a reservation has succeeded. The caller must persist the returned
 * slices atomically (the existing governance reservation transaction/lock is the
 * authoritative spend boundary).
 *
 * Design invariants:
 * - locked mode never consumes another member's shareable allocation;
 * - protected member capacity is never consumed;
 * - borrowing is bounded by policy;
 * - emergency reserve is priority-gated;
 * - insufficient plans fail closed and return the exact shortfall.
 */
export function planAdaptiveCapacity(
  request: CapacityRequest,
  sources: CapacitySource[],
  policy: AdaptiveBudgetPolicy,
): CapacityPlan {
  const requestedUsd = money(request.amountUsd);
  if (requestedUsd <= 0) {
    return {
      requestId: request.requestId,
      allowed: false,
      requestedUsd,
      reservedUsd: 0,
      shortfallUsd: requestedUsd,
      borrowedUsd: 0,
      requiresApproval: false,
      slices: [],
      reasons: ["request amount must be greater than zero"],
    };
  }

  const ordered = [...sources].sort((a, b) => {
    const byType = sourcePriority(a) - sourcePriority(b);
    return byType !== 0 ? byType : (a.rank ?? 100) - (b.rank ?? 100);
  });

  let remaining = requestedUsd;
  let borrowedUsd = 0;
  const slices: CapacityReservationSlice[] = [];
  const reasons: string[] = [];

  for (const source of ordered) {
    if (remaining <= 0) break;

    if (source.type === "member_shareable") {
      if (policy.mode === "locked") continue;
      if (request.allowBorrow === false) continue;
      if (borrowedUsd >= money(policy.maxBorrowUsd)) continue;
    }

    if (source.type === "emergency_reserve") {
      if (!request.allowEmergency) continue;
      if (!canUseEmergency(request.priority, policy.emergencyMinPriority)) continue;
    }

    const protectedUsd =
      source.type === "member_shareable" ? money(source.protectedUsd ?? 0) : 0;
    let usableUsd = money(source.availableUsd - protectedUsd);
    if (usableUsd <= 0) continue;

    if (source.type === "member_shareable") {
      usableUsd = Math.min(usableUsd, money(policy.maxBorrowUsd - borrowedUsd));
    }

    const takeUsd = money(Math.min(remaining, usableUsd));
    if (takeUsd <= 0) continue;

    slices.push({
      sourceId: source.id,
      sourceType: source.type,
      amountUsd: takeUsd,
      ownerIdentityId: source.ownerIdentityId,
      ownerProjectId: source.ownerProjectId,
    });

    if (source.type === "member_shareable") borrowedUsd = money(borrowedUsd + takeUsd);
    remaining = money(remaining - takeUsd);
  }

  const reservedUsd = money(requestedUsd - remaining);
  const requiresApproval = borrowedUsd > money(policy.approvalThresholdUsd);

  if (borrowedUsd > 0) {
    reasons.push(`planned ${borrowedUsd.toFixed(2)} USD from shareable capacity`);
  }
  if (slices.some((slice) => slice.sourceType === "emergency_reserve")) {
    reasons.push("emergency reserve included");
  }
  if (requiresApproval) reasons.push("borrow amount exceeds automatic approval threshold");
  if (remaining > 0) {
    reasons.push(`insufficient approved capacity; shortfall ${remaining.toFixed(2)} USD`);
  }

  return {
    requestId: request.requestId,
    allowed: remaining === 0 && !requiresApproval,
    requestedUsd,
    reservedUsd,
    shortfallUsd: remaining,
    borrowedUsd,
    requiresApproval,
    slices,
    reasons,
  };
}
