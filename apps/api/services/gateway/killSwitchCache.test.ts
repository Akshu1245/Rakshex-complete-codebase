import { beforeEach, describe, expect, it, vi } from "vitest";

const setex = vi.fn();
const get = vi.fn();
const publish = vi.fn();

vi.mock("../../_core/cache", () => ({
  redis: {
    setex: (...args: unknown[]) => setex(...args),
    get: (...args: unknown[]) => get(...args),
    publish: (...args: unknown[]) => publish(...args),
  },
}));

vi.mock("../../_core/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  publishKillSwitchState,
  publishScopedKillSwitch,
  readKillSwitchCache,
  readMergedKillSwitchState,
} from "./killSwitchCache";
import { killSwitchRedisKey } from "./enforcement";

describe("killSwitchCache", () => {
  beforeEach(() => {
    setex.mockReset();
    get.mockReset();
    publish.mockReset();
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

  it("publishes identity and agent under distinct redis namespaces", async () => {
    setex.mockResolvedValue("OK");
    await publishScopedKillSwitch({
      workspaceId: 9,
      scopeType: "identity",
      scopeId: "42",
      active: true,
      version: 3,
    });
    await publishScopedKillSwitch({
      workspaceId: 9,
      scopeType: "agent",
      scopeId: "42",
      active: true,
      version: 3,
    });

    expect(setex.mock.calls[0]![0]).toBe(killSwitchRedisKey("identity", "9:42"));
    expect(setex.mock.calls[1]![0]).toBe(killSwitchRedisKey("agent", "9:42"));
    expect(setex.mock.calls[0]![0]).not.toBe(setex.mock.calls[1]![0]);
  });

  it("merged read does not treat identity kill as agent kill", async () => {
    get.mockImplementation(async (key: string) => {
      if (key === killSwitchRedisKey("workspace", "9")) {
        return JSON.stringify({ isActive: false, updatedAt: "2026-01-01T00:00:00.000Z" });
      }
      if (key === killSwitchRedisKey("identity", "9:42")) {
        return JSON.stringify({ active: true, version: 1 });
      }
      return null;
    });

    const state = await readMergedKillSwitchState({
      workspaceId: 9,
      identityId: 42,
      agentId: "42",
    });

    expect(state.identityDisabled).toBe(true);
    expect(state.agentDisabled).toBe(false);
    expect(state.workspaceDisabled).toBe(false);
  });

  it("merged read honors project and agent scopes independently", async () => {
    get.mockImplementation(async (key: string) => {
      if (key === killSwitchRedisKey("workspace", "3")) {
        return JSON.stringify({ isActive: false, updatedAt: "2026-01-01T00:00:00.000Z" });
      }
      if (key === killSwitchRedisKey("project", "3:proj-a")) {
        return JSON.stringify({ active: true });
      }
      if (key === killSwitchRedisKey("agent", "3:bot-1")) {
        return JSON.stringify({ active: true });
      }
      return null;
    });

    const state = await readMergedKillSwitchState({
      workspaceId: 3,
      projectId: "proj-a",
      agentId: "bot-1",
    });

    expect(state.projectDisabled).toBe(true);
    expect(state.agentDisabled).toBe(true);
    expect(state.identityDisabled).toBe(false);
  });
});
