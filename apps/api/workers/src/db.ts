import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { Env } from "./env";
import * as schema from "./schema";

export type WorkersDb = DrizzleD1Database<typeof schema>;

/** Per-request drizzle instance bound to the request's D1 binding. */
export function createDb(env: Env): WorkersDb {
  return drizzle(env.DB, { schema });
}
