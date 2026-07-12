/**
 * @rakshex/database — schema and relations entrypoint.
 * SQL migrations live under packages/database/drizzle (versioned, PostgreSQL).
 */
export * from "../drizzle/schema";
export * from "../drizzle/schema-foundation";
export * from "../drizzle/schema-enterprise";
export * from "../drizzle/relations";
export * from "../drizzle/relations-enterprise";

export { migrate, listMigrations } from "./migrate";
export { resetDatabase } from "./reset";
export { seed, SEED_FIXTURES } from "./seed";
export { createDb, type RakshexDb } from "./client";
