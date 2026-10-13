import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("background job queue production startup safeguards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("RAKSHEX_REDIS_URL", "");
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.doUnmock("bullmq");
    vi.unstubAllEnvs();
  });

  it("rejects queue access before initialization in production", async () => {
    const { getJobQueue } = await import("./jobQueue");
    expect(() => getJobQueue()).toThrow(/Production job queue is not initialized/);
  });

  it("fails startup without Redis rather than silently using memory", async () => {
    const { initJobQueue, getJobQueue } = await import("./jobQueue");
    await expect(initJobQueue()).rejects.toThrow(
      /Production job queue requires REDIS_URL or RAKSHEX_REDIS_URL/,
    );
    expect(() => getJobQueue()).toThrow(/Production job queue is not initialized/);
  });

  it("fails startup if BullMQ cannot load in production", async () => {
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
    vi.doMock("bullmq", () => {
      throw new Error("test: BullMQ unavailable");
    });
    const { initJobQueue, getJobQueue } = await import("./jobQueue");
    await expect(initJobQueue()).rejects.toThrow(/Production BullMQ initialization failed/);
    expect(() => getJobQueue()).toThrow(/Production job queue is not initialized/);
  });

  it("preserves local development's in-memory queue fallback", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { initJobQueue, getJobQueue } = await import("./jobQueue");
    await expect(initJobQueue()).resolves.toBeUndefined();
    expect(getJobQueue()).toBeDefined();
  });
});
