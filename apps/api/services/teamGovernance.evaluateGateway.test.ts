import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const readMergedKillSwitchState = vi.fn();

vi.mock("../db", () => ({
  getDb: (...args: unknown[]) => getDb(...args),
}));

vi.mock("./gateway/killSwitchCache", () => ({
  readMergedKillSwitchState: (...args: unknown[]) => readMergedKillSwitchState(...args),
  publishScopedKillSwitch: vi.fn(),
  publishWorkspaceKillSwitch: vi.fn(),
  toEnforcementKillState: vi.fn(),
}));

vi.mock("../_core/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { evaluateGatewayGovernance, reserveGatewayBudget } from "./teamGovernance";

describe("evaluateGatewayGovernance", () => {
  beforeEach(() => {
    getDb.mockReset();
    readMergedKillSwitchState.mockReset();
  });

  it("fail-closed when governance DB is unavailable", async () => {
    getDb.mockResolvedValue(null);
    await expect(
      evaluateGatewayGovernance({ workspaceId: 1, estimatedCostUsd: 0 }),
    ).rejects.toThrow(/fail-closed/i);
  });

  it("blocks when durable PG kill switch is active even if Redis misses", async () => {
    readMergedKillSwitchState.mockResolvedValue({
      workspaceDisabled: false,
      identityDisabled: false,
      projectDisabled: false,
      agentDisabled: false,
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const killRows = [
      {
        scopeType: "identity",
        scopeId: "7",
        active: true,
      },
    ];
    const budgetRows: unknown[] = [];

    let selectCall = 0;
    const database = {
      select: () => {
        selectCall += 1;
        const rows = selectCall === 1 ? killRows : budgetRows;
        // Promise-like thenable returned from where()
        return {
          from: () => ({
            where: () => Promise.resolve(rows),
          }),
        };
      },
    };
    getDb.mockResolvedValue(database);

    const result = await evaluateGatewayGovernance({
      workspaceId: 1,
      identityId: 7,
      estimatedCostUsd: 0.01,
    });

    expect(result.allowed).toBe(false);
    expect(result.killActive).toBe(true);
    expect(result.state.identityDisabled).toBe(true);
  });

  it("blocks hard gateway budgets and never claims monitor_only as a RakshEx block", async () => {
    readMergedKillSwitchState.mockResolvedValue({
      workspaceDisabled: false,
      identityDisabled: false,
      projectDisabled: false,
      agentDisabled: false,
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const hardBudget = {
      identityId: null,
      limitUsd: "10",
      currentSpendUsd: "9.5",
      hardLimit: true,
      enforcementMode: "gateway",
    };
    const monitorBudget = {
      identityId: null,
      limitUsd: "10",
      currentSpendUsd: "99",
      hardLimit: true,
      enforcementMode: "monitor_only",
    };

    const databaseHard = {
      select: (() => {
        let n = 0;
        return () => {
          n += 1;
          const rows = n === 1 ? [] : [hardBudget];
          return { from: () => ({ where: () => Promise.resolve(rows) }) };
        };
      })(),
    };
    getDb.mockResolvedValue(databaseHard);
    const hard = await evaluateGatewayGovernance({
      workspaceId: 2,
      estimatedCostUsd: 1,
    });
    expect(hard.allowed).toBe(false);
    expect(hard.budgetBlocked).toBe(true);

    const databaseMonitor = {
      select: (() => {
        let n = 0;
        return () => {
          n += 1;
          const rows = n === 1 ? [] : [monitorBudget];
          return { from: () => ({ where: () => Promise.resolve(rows) }) };
        };
      })(),
    };
    getDb.mockResolvedValue(databaseMonitor);
    const monitor = await evaluateGatewayGovernance({
      workspaceId: 2,
      estimatedCostUsd: 1,
    });
    expect(monitor.budgetBlocked).toBe(false);
    expect(monitor.budgetReason).toMatch(/monitor_only/i);
    expect(monitor.allowed).toBe(true);
  });
});

describe("reserveGatewayBudget", () => {
  beforeEach(() => {
    getDb.mockReset();
  });

  function databaseForReservation(returningRows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(returningRows);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const budgets = [
      {
        id: 9,
        workspaceId: 2,
        identityId: null,
        limitUsd: "10",
        currentSpendUsd: "8",
        hardLimit: true,
        enforcementMode: "gateway",
      },
    ];
    return {
      database: {
        select: () => ({
          from: () => ({ where: () => Promise.resolve(budgets) }),
        }),
        update,
      },
      update,
      set,
      where,
      returning,
    };
  }

  it("atomically reserves estimated spend when the conditional update succeeds", async () => {
    const mock = databaseForReservation([{ id: 9 }]);
    getDb.mockResolvedValue(mock.database);

    const result = await reserveGatewayBudget({
      workspaceId: 2,
      estimatedCostUsd: 1.5,
    });

    expect(result).toEqual({
      allowed: true,
      reservation: {
        budgetId: 9,
        workspaceId: 2,
        identityId: null,
        reservedUsd: 1.5,
      },
    });
    expect(mock.update).toHaveBeenCalledTimes(1);
    expect(mock.returning).toHaveBeenCalledTimes(1);
  });

  it("blocks when a concurrent reservation exhausts the conditional update", async () => {
    const mock = databaseForReservation([]);
    getDb.mockResolvedValue(mock.database);

    const result = await reserveGatewayBudget({
      workspaceId: 2,
      estimatedCostUsd: 3,
    });

    expect(result).toEqual({
      allowed: false,
      reason: "identity/workspace gateway budget would be exceeded",
    });
  });
});
