/**
 * Drop and recreate the public schema, then re-run all migrations.
 * LOCAL / TEST ONLY — refuses non-local hosts unless RAKSHEX_ALLOW_DB_RESET=1.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @rakshex/database db:reset
 */

import pg from "pg";
import { migrate } from "./migrate.js";

function assertSafeToReset(url: string): void {
  if (process.env.RAKSHEX_ALLOW_DB_RESET === "1") return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "postgres"; // docker compose service name
  if (!local) {
    throw new Error(
      `Refusing to reset non-local database host "${host}". Set RAKSHEX_ALLOW_DB_RESET=1 to override.`,
    );
  }
}

export async function resetDatabase(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  assertSafeToReset(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end();
  }

  const applied = await migrate(url);
  console.log("[reset] Re-applied migrations:", applied.join(", ") || "(none new)");
}

const isCli = process.argv[1]?.includes("reset");
if (isCli) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[reset] Failed:", err);
      process.exit(1);
    });
}
