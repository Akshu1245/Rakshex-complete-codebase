import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./index.js";

export function createDb(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type RakshexDb = ReturnType<typeof createDb>["db"];
