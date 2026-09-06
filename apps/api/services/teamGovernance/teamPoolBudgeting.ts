import type { TeamAiBudget } from "@rakshex/database/schema-enterprise";
import {
  planAdaptiveCapacity,
  type AdaptiveBudgetPolicy,
  type AllocationMode,
  type CapacityPriority,
  type CapacitySource,
} from "./adaptiveBudgeting";

export interface TeamPoolConfig {
  enabled: boolean;
  mode: AllocationMode;
  maxBorrowUsd: number;
  approvalThresholdUsd: number;
  emergencyMinPriority: CapacityPriority;
  /** Dollars held back from team_shared for emergency_reserve sourcing. */
  emergencyReserveUsd: number;
}

export interface IdentityPoolConfig {
  /** Minimum capacity this identity keeps; cannot be borrowed by others. */
  protectedUsd: number;
  /** When true, unused capacity above protectedUsd can be borrowed by teammates. */
  shareable: boolean;
}

const DEFAULT_POOL: TeamPoolConfig = {
  enabled: false,
  mode: "shareable",
  maxBorrowUsd: 25,
  approvalThresholdUsd: 20,
  emergencyMinPriority: "critical",
  emergencyReserveUsd: 0,
};

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function budgetMeta(budget: TeamAiBudget): Record<string, unknown> {
  return budget.metadata && typeof budget.metadata === "object"
    ? (budget.metadata as Record<string, unknown>)
    : {};
}

export function parseTeamPoolConfig(workspaceBudget: TeamAiBudget | undefined): TeamPoolConfig {
  if (!workspaceBudget) return DEFAULT_POOL;
  const pool = budgetMeta(workspaceBudget).pool;
  if (!pool || typeof pool !== "object") return DEFAULT_POOL;
  const record = pool as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    mode:
      record.mode === "locked" || record.mode === "pooled" || record.mode === "shareable"
        ? record.mode
        : "shareable",
    maxBorrowUsd:
      typeof record.maxBorrowUsd === "number" && record.maxBorrowUsd >= 0
        ? record.maxBorrowUsd
        : DEFAULT_POOL.maxBorrowUsd,
    approvalThresholdUsd:
      typeof record.approvalThresholdUsd === "number" && record.approvalThresholdUsd >= 0
        ? record.approvalThresholdUsd
        : DEFAULT_POOL.approvalThresholdUsd,
    emergencyMinPriority:
      record.emergencyMinPriority === "experimental" ||
      record.emergencyMinPriority === "normal" ||
      record.emergencyMinPriority === "customer" ||
      record.emergencyMinPriority === "critical"
        ? record.emergencyMinPriority
        : DEFAULT_POOL.emergencyMinPriority,
    emergencyReserveUsd:
      typeof record.emergencyReserveUsd === "number" && record.emergencyReserveUsd >= 0
        ? record.emergencyReserveUsd
        : 0,
  };
}

export function parseIdentityPoolConfig(budget: TeamAiBudget): IdentityPoolConfig {
  const record = budgetMeta(budget);
  return {
    protectedUsd:
      typeof record.protectedUsd === "number" && record.protectedUsd >= 0 ? record.protectedUsd : 0,
    shareable: record.shareable !== false,
  };
}

function isGatewayHardBudget(budget: TeamAiBudget): boolean {
  return budget.hardLimit && budget.enforcementMode === "gateway";
}

function budgetAvailable(budget: TeamAiBudget): number {
  return Math.max(0, toNumber(budget.limitUsd) - toNumber(budget.currentSpendUsd));
}

/**
 * Build capacity sources for adaptive pool planning from persisted budgets.
 * Only gateway hard budgets participate in pool borrowing.
 */
export function buildCapacitySources(
  budgets: TeamAiBudget[],
  requestIdentityId?: number,
  poolConfig?: TeamPoolConfig,
): CapacitySource[] {
  const sources: CapacitySource[] = [];
  const pool = poolConfig ?? DEFAULT_POOL;

  if (requestIdentityId != null) {
    const personal = budgets.find(
      (b) => b.identityId === requestIdentityId && isGatewayHardBudget(b),
    );
    if (personal) {
      sources.push({
        id: `budget:${personal.id}`,
        type: "personal",
        availableUsd: budgetAvailable(personal),
        ownerIdentityId: requestIdentityId,
      });
    }
  }

  const workspace = budgets.find((b) => b.identityId == null && isGatewayHardBudget(b));
  if (workspace) {
    const workspaceAvailable = budgetAvailable(workspace);
    const emergencyHeld = pool.enabled ? pool.emergencyReserveUsd : 0;
    const teamSharedAvailable = Math.max(0, workspaceAvailable - emergencyHeld);
    if (teamSharedAvailable > 0) {
      sources.push({
        id: `budget:${workspace.id}`,
        type: "team_shared",
        availableUsd: teamSharedAvailable,
      });
    }
    if (pool.enabled && emergencyHeld > 0) {
      sources.push({
        id: `emergency:${workspace.id}`,
        type: "emergency_reserve",
        availableUsd: Math.min(emergencyHeld, workspaceAvailable),
      });
    }
  }

  if (pool.enabled && pool.mode !== "locked") {
    for (const memberBudget of budgets) {
      if (memberBudget.identityId == null || memberBudget.identityId === requestIdentityId) {
        continue;
      }
      if (!isGatewayHardBudget(memberBudget)) continue;
      const identityPool = parseIdentityPoolConfig(memberBudget);
      if (!identityPool.shareable) continue;
      const available = budgetAvailable(memberBudget);
      if (available <= identityPool.protectedUsd) continue;
      sources.push({
        id: `budget:${memberBudget.id}`,
        type: "member_shareable",
        availableUsd: available,
        protectedUsd: identityPool.protectedUsd,
        ownerIdentityId: memberBudget.identityId ?? undefined,
      });
    }
  }

  return sources;
}

export function adaptivePolicyFromPool(pool: TeamPoolConfig): AdaptiveBudgetPolicy {
  return {
    mode: pool.mode,
    maxBorrowUsd: pool.maxBorrowUsd,
    approvalThresholdUsd: pool.approvalThresholdUsd,
    emergencyMinPriority: pool.emergencyMinPriority,
  };
}

/** Map a capacity slice source id back to a team_ai_budgets row id. */
export function budgetIdFromSourceId(sourceId: string): number | null {
  if (sourceId.startsWith("budget:")) {
    const id = Number.parseInt(sourceId.slice("budget:".length), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  if (sourceId.startsWith("emergency:")) {
    const id = Number.parseInt(sourceId.slice("emergency:".length), 10);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

export { planAdaptiveCapacity };
