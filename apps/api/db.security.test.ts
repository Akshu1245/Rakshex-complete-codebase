/**
 * Security regression tests for db.ts
 *
 * These tests ensure that getUserById / getUserByApiKey never return
 * fake "demo" users when the database is unavailable. Returning a stub
 * user on DB outage would let unauthenticated requests run with real
 * privileges — a critical auth bypass.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// We import the real module but stub getDb to simulate outage.
import * as db from "./db";

describe("db security — no fake demo user on DB outage", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    // Ensure we trigger the "no DB" path
    delete process.env.DATABASE_URL;
    // Clear any cached db instance
    (db as any)._db = null;
    (db as any)._dbInitPromise = null;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    }
    (db as any)._db = null;
    (db as any)._dbInitPromise = null;
  });

  it("getUserById returns undefined (not a fake demo user) when DB is down", async () => {
    const user = await db.getUserById(1);
    expect(user).toBeUndefined();
  });

  it("getUserByApiKey returns undefined (not a fake demo user) when DB is down", async () => {
    const user = await db.getUserByApiKey("dp_any_key");
    expect(user).toBeUndefined();
  });

  it("getUserByApiKey does not accept arbitrary dp_ keys when DB is down", async () => {
    const user = await db.getUserByApiKey("dp_malicious_key_123");
    expect(user).toBeUndefined();
  });

  it("getCollectionsByUserId returns empty array (not demo data) when DB is down", async () => {
    const rows = await db.getCollectionsByUserId(1);
    expect(rows).toEqual([]);
  });

  it("getFindingsByScanId returns empty array (not demo findings) when DB is down", async () => {
    const rows = await db.getFindingsByScanId("scan_any");
    expect(rows).toEqual([]);
  });

  it("getScanById returns null (not a fabricated scan) when DB is down", async () => {
    const scan = await db.getScanById("scan_any");
    expect(scan).toBeNull();
  });

  it("getRecentFindingsForUser returns empty array when DB is down", async () => {
    const rows = await db.getRecentFindingsForUser(1);
    expect(rows).toEqual([]);
  });

  it("getCollectionById returns null (not a fabricated collection) when DB is down", async () => {
    const row = await db.getCollectionById("col_any");
    expect(row).toBeNull();
  });
});
