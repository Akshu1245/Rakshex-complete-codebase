/**
 * prepare → download metadata path (token stores metadata only; one-time consume).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { storePendingExport, consumePendingExportMeta, MAX_EXPORT_ROWS } from "./dataExport";

describe("data export prepare/download metadata", () => {
  const originalRedis = process.env.REDIS_URL;

  beforeEach(() => {
    // Force in-process Map path so tests do not depend on a live Redis.
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    if (originalRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedis;
  });

  it("round-trips metadata and consumes the token once", async () => {
    const token = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = Date.now() + 60_000;

    await storePendingExport(token, {
      userId: 42,
      format: "json",
      resource: "token_usage",
      days: 30,
      expiresAt,
    });

    const meta = await consumePendingExportMeta(token);
    expect(meta).toMatchObject({
      userId: 42,
      format: "json",
      resource: "token_usage",
      days: 30,
    });
    expect(meta?.expiresAt).toBe(expiresAt);

    // One-time token — second consume must miss.
    expect(await consumePendingExportMeta(token)).toBeNull();
  });

  it("returns null for expired metadata tokens", async () => {
    const token = `tok_expired_${Date.now()}`;
    await storePendingExport(token, {
      userId: 7,
      format: "csv",
      resource: "scan_history",
      days: 7,
      expiresAt: Date.now() - 1,
    });

    expect(await consumePendingExportMeta(token)).toBeNull();
  });

  it("exposes a hard row cap for download materialization", () => {
    expect(MAX_EXPORT_ROWS).toBe(10_000);
  });
});
