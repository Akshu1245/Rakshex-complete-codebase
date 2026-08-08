import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./index.js";

export function createDb(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const useSsl =
    url.includes("sslmode=require") ||
    url.includes("render.com") ||
    url.includes("neon.tech") ||
    url.includes("supabase.co");
  const pool = new pg.Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type RakshexDb = ReturnType<typeof createDb>["db"];
