import { describe, expect, it } from "vitest";
import type { TeamAiBudget } from "@rakshex/database/schema-enterprise";
import {
  buildCapacitySources,
  parseTeamPoolConfig,
  planAdaptiveCapacity,
  adaptivePolicyFromPool,
} from "./teamPoolBudgeting";

function budget(
  id: number,
  workspaceId: number,
  identityId: number | null,
  limitUsd: number,
  spendUsd: number,
  metadata?: Record<string, unknown>,
): TeamAiBudget {
  return {
    id,
    workspaceId,
    identityId,
    period: "monthly",
    limitUsd: String(limitUsd),
    warningPct: 80,
    hardLimit: true,
    enforcementMode: "gateway",
    currentSpendUsd: String(spendUsd),
    periodStart: new Date(),
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("team pool budgeting", () => {
  it("parses pool config from workspace budget metadata", () => {
    const cfg = parseTeamPoolConfig(
      budget(1, 42, null, 1000, 0, {
        pool: {
          enabled: true,
          mode: "shareable",
          maxBorrowUsd: 40,
          emergencyReserveUsd: 100,
        },
      }),
    );
    expect(cfg.enabled).toBe(true);
    expect(cfg.maxBorrowUsd).toBe(40);
    expect(cfg.emergencyReserveUsd).toBe(100);
  });

  it("builds personal, team, and shareable sources for adaptive planning", () => {
    const workspace = budget(1, 42, null, 100, 99, {
      pool: { enabled: true, mode: "shareable", emergencyReserveUsd: 0 },
    });
    const requester = budget(2, 42, 10, 50, 48);
    const teammate = budget(3, 42, 11, 30, 5, { shareable: true, protectedUsd: 10 });

    const pool = {
      enabled: true,
      mode: "shareable" as const,
      maxBorrowUsd: 25,
      approvalThresholdUsd: 20,
      emergencyMinPriority: "critical" as const,
      emergencyReserveUsd: 0,
    };

    const sources = buildCapacitySources([workspace, requester, teammate], 10, pool);

    const plan = planAdaptiveCapacity(
      { requestId: "r1", amountUsd: 8, priority: "customer", allowBorrow: true },
      sources,
      adaptivePolicyFromPool(pool),
    );

    expect(plan.allowed).toBe(true);
    expect(plan.reservedUsd).toBe(8);
    expect(plan.borrowedUsd).toBeGreaterThan(0);
    expect(plan.slices.some((slice) => slice.sourceType === "member_shareable")).toBe(true);
  });
});
