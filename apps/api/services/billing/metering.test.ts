/**
 * Metering tests — DB layer is mocked (no live database in this environment).
 * Live-DB integration still needs a reachable Postgres (repo AGENTS.md).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  const rows = vi.fn().mockResolvedValue([] as Array<{ quantity: string }>);
  const where = vi.fn().mockImplementation(() => rows());
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const getDb = vi.fn().mockResolvedValue({ insert, select });
  return { values, insert, rows, where, from, select, getDb };
});

vi.mock("../../db", () => ({ getDb: mocks.getDb }));

import { checkPlanQuota, recordBillableEvent, sumPeriodUsage } from "./metering";

describe("metering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a billable event as a usage_events row", async () => {
    const id = await recordBillableEvent({
      workspaceId: 7,
      eventType: "tokens",
      quantity: 150,
      costUsd: 0.0042,
    });
    expect(typeof id).toBe("string");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const payload = mocks.values.mock.calls[0][0];
    expect(payload.workspaceId).toBe(7);
    expect(payload.eventType).toBe("tokens");
    expect(payload.quantity).toBe("150");
    expect(payload.unit).toBe("tokens");
    expect(payload.costUsd).toBe("0.0042");
    expect(payload.metadata).toBeNull();
  });

  it("sums period usage across samples", async () => {
    mocks.rows.mockResolvedValueOnce([
      { quantity: "100" },
      { quantity: "50" },
      { quantity: "25" },
    ]);
    const usage = await sumPeriodUsage({
      workspaceId: 7,
      eventType: "api_calls",
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-10-01"),
    });
    expect(usage).toEqual({ total: 175, samples: 3 });
  });

  it("flags quota breach with overage priced from the plan catalog", async () => {
    mocks.rows.mockResolvedValueOnce([{ quantity: "11500" }, { quantity: "500" }]);
    const quota = await checkPlanQuota({
      workspaceId: 7,
      planId: "pro", // limit 10_000, overage 1¢/unit
      eventType: "api_calls",
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-10-01"),
    });
    expect(quota.allowed).toBe(false);
    expect(quota.used).toBe(12000);
    expect(quota.limit).toBe(10000);
    expect(quota.overageUnits).toBe(2000);
    expect(quota.overageCents).toBe(2000);
  });

  it("allows usage under the limit with zero overage", async () => {
    mocks.rows.mockResolvedValueOnce([{ quantity: "50" }]);
    const quota = await checkPlanQuota({
      workspaceId: 7,
      planId: "free",
      eventType: "api_calls",
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-10-01"),
    });
    expect(quota.allowed).toBe(true);
    expect(quota.overageUnits).toBe(0);
    expect(quota.overageCents).toBe(0);
  });
});
