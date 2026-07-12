import { beforeEach, describe, expect, it, vi } from "vitest";

const setex = vi.fn();
const get = vi.fn();

vi.mock("../../_core/cache", () => ({
  redis: {
    setex: (...args: unknown[]) => setex(...args),
    get: (...args: unknown[]) => get(...args),
  },
}));

vi.mock("../../_core/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { publishKillSwitchState, readKillSwitchCache } from "./killSwitchCache";
import { killSwitchRedisKey } from "./enforcement";

describe("killSwitchCache", () => {
  beforeEach(() => {
    setex.mockReset();
    get.mockReset();
  });

  it("publishes active state under user-scoped redis key", async () => {
    setex.mockResolvedValue("OK");
    await publishKillSwitchState(42, {
      isActive: true,
      budgetLimitUsd: 100,
      currentSpendUsd: 12.5,
    });
    expect(setex).toHaveBeenCalledTimes(1);
    const [key, ttl, raw] = setex.mock.calls[0] as [string, number, string];
    expect(key).toBe(killSwitchRedisKey("workspace", "user:42"));
    expect(ttl).toBeGreaterThan(0);
    const parsed = JSON.parse(raw);
    expect(parsed.isActive).toBe(true);
    expect(parsed.userId).toBe(42);
    expect(parsed.budgetLimitUsd).toBe(100);
    expect(parsed.updatedAt).toBeTruthy();
  });

  it("reads cached state and returns null on miss", async () => {
    get.mockResolvedValueOnce(null);
    expect(await readKillSwitchCache(7)).toBeNull();

    get.mockResolvedValueOnce(
      JSON.stringify({
        isActive: false,
        userId: 7,
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const hit = await readKillSwitchCache(7);
    expect(hit?.isActive).toBe(false);
    expect(hit?.userId).toBe(7);
  });

  it("swallows redis publish errors (PG remains source of truth)", async () => {
    setex.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(publishKillSwitchState(1, { isActive: true })).resolves.toBeUndefined();
  });
});
