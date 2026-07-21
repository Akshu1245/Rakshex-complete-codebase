/**
 * Redis must be required in production — no silent MockRedis / mock BullMQ.
 */
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

describe("Redis required in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedis = process.env.REDIS_URL;
  const originalUseInMemory = process.env.USE_IN_MEMORY_REDIS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedis;
    if (originalUseInMemory === undefined) delete process.env.USE_IN_MEMORY_REDIS;
    else process.env.USE_IN_MEMORY_REDIS = originalUseInMemory;
    vi.resetModules();
  });

  it("cache module refuses to start without REDIS_URL in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_URL;
    delete process.env.USE_IN_MEMORY_REDIS;

    vi.doMock("./logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));

    await expect(import("./cache")).rejects.toThrow(/REDIS_URL is required in production/);
  });

  it("queues module refuses mock BullMQ without REDIS_URL in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.REDIS_URL;

    vi.doMock("../_core/cache", () => ({
      redis: { status: "ready" },
    }));
    vi.doMock("../_core/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));

    await expect(import("../queues/index")).rejects.toThrow(/REDIS_URL is required in production/);
  });
});
