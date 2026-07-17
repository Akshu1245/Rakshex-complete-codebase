// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  redisUrl: (process.env.REDIS_URL = "redis://test"),
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
  multi: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      on: vi.fn(),
      multi: mocks.multi.mockReturnValue({
        zremrangebyscore: mocks.zremrangebyscore,
        zadd: mocks.zadd,
        zcard: mocks.zcard,
        pexpire: mocks.pexpire,
        exec: mocks.exec,
      }),
    };
  }),
}));

import { rateLimitSlidingWindow } from "./_core/cache";

describe("rateLimitSlidingWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.multi.mockReturnValue({
      zremrangebyscore: mocks.zremrangebyscore,
      zadd: mocks.zadd,
      zcard: mocks.zcard,
      pexpire: mocks.pexpire,
      exec: mocks.exec,
    });
    mocks.exec.mockResolvedValue([
      [null, 10],
      [null, 1],
      [null, 5],
      [null, 1],
    ]);
  });

  it("allows requests under the limit", async () => {
    mocks.exec.mockResolvedValue([
      [null, 10],
      [null, 1],
      [null, 5],
      [null, 1],
    ]);

    const result = await rateLimitSlidingWindow("test:key", 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(5);
  });

  it("allows requests at the limit boundary", async () => {
    mocks.exec.mockResolvedValue([
      [null, 10],
      [null, 1],
      [null, 10],
      [null, 1],
    ]);

    const result = await rateLimitSlidingWindow("test:key", 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(10);
  });

  it("blocks requests over the limit", async () => {
    mocks.exec.mockResolvedValue([
      [null, 10],
      [null, 1],
      [null, 11],
      [null, 1],
    ]);

    const result = await rateLimitSlidingWindow("test:key", 10, 60000);
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(11);
  });

  it("fails open when Redis errors", async () => {
    mocks.exec.mockRejectedValue(new Error("Connection refused"));

    const result = await rateLimitSlidingWindow("test:key", 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
  });

  it("removes old entries from the sorted set", async () => {
    await rateLimitSlidingWindow("test:key", 10, 60000);

    expect(mocks.zremrangebyscore).toHaveBeenCalledWith("test:key", 0, expect.any(Number));
    const windowStart = mocks.zremrangebyscore.mock.calls[0][2];
    const now = Date.now();
    expect(windowStart).toBeGreaterThan(now - 61000);
    expect(windowStart).toBeLessThanOrEqual(now);
  });

  it("sets key expiry on every call", async () => {
    await rateLimitSlidingWindow("test:key", 10, 60000);
    expect(mocks.pexpire).toHaveBeenCalledWith("test:key", 60000);
  });

  it("returns a future resetAt timestamp", async () => {
    const before = Date.now();
    const result = await rateLimitSlidingWindow("test:key", 10, 60000);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 61000);
  });
});
