import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "../_core/logger";

let _db: PostgresJsDatabase<Record<string, unknown>> | null = null;
let _client: postgres.Sql | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, {
        max: 20,
        connect_timeout: 5,
      });
      _db = drizzle(_client);
    } catch (error) {
      logger.error({ err: error }, "[Database] Failed to initialize connection");
      _db = null;
      _client = null;
    }
  }
  return _db;
}

export async function closeDb() {
  if (_client) {
    await _client.end();
    logger.info("[Database] Connection pool closed");
    _client = null;
    _db = null;
  }
}

// Re-export everything from drizzle schema
export * from "../../drizzle/schema";

// Export query modules
export * from "./queries/users";
export * from "./queries/collections";
