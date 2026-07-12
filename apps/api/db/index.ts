import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { logger } from "../_core/logger";
import { eq, desc } from "drizzle-orm";
import { assertDb } from "../_core/errors";
import {
  redteamRuns,
  redteamFindings,
  type InsertRedteamRunRow,
  type RedteamRunRow,
  type InsertRedteamFindingRow,
} from "@rakshex/database";

let _db: NodePgDatabase<Record<string, unknown>> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
      });
      _db = drizzle(pool);
    } catch (error) {
      logger.warn({ err: error }, "[Database] Failed to connect");
      _db = null;
    }
  }
  return _db;
}

// Re-export everything from drizzle schema
export * from "@rakshex/database";

// ── Red-team helpers (inlined from ../db.ts) ──────────────────────────────

export async function createRedteamRun(row: InsertRedteamRunRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(redteamRuns).values(row);
}

export async function updateRedteamRun(id: string, patch: Partial<RedteamRunRow>): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.update(redteamRuns).set(patch).where(eq(redteamRuns.id, id));
}

export async function getRedteamRun(id: string): Promise<RedteamRunRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(redteamRuns).where(eq(redteamRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function recordRedteamFindings(rows: InsertRedteamFindingRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  assertDb(db);
  await db.insert(redteamFindings).values(rows);
}

// Export query modules
export * from "./queries/users";
export * from "./queries/collections";
