/**
 * Apply versioned SQL migrations under packages/database/drizzle.
 * Tracks applied tags in rakshex_schema_migrations.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @rakshex/database db:migrate
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.resolve(__dirname, "../drizzle");

const MIGRATION_ORDER = [
  "0000_curly_dark_phoenix.sql",
  "0001_notifications_and_feature_flags.sql",
  "0002_auth_and_settings.sql",
  "0003_enterprise.sql",
  "0004_api_key_hardening.sql",
  "0005_universal_control_plane.sql",
  "0006_github_installations.sql",
  "0007_market_ready_foundation.sql",
  "0008_auth_resource_model.sql",
  "0009_findings_lifecycle.sql",
  "0010_p1_workspace_tenancy.sql",
  "0011_p3_hot_path_indexes.sql",
];

export async function migrate(databaseUrl?: string): Promise<string[]> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for migrations");
  }
  if (!url.startsWith("postgres")) {
    throw new Error(
      `DATABASE_URL must be a PostgreSQL connection string (got non-postgres scheme)`,
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rakshex_schema_migrations (
        id serial PRIMARY KEY,
        tag text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await client.query<{ tag: string }>(
      `SELECT tag FROM rakshex_schema_migrations ORDER BY id ASC`,
    );
    const done = new Set(rows.map((r) => r.tag));

    const files = await readdir(DRIZZLE_DIR);
    for (const file of MIGRATION_ORDER) {
      if (!files.includes(file)) {
        throw new Error(`Missing migration file: ${file}`);
      }
      const tag = file.replace(/\.sql$/, "");
      if (done.has(tag)) {
        continue;
      }
      const sql = await readFile(path.join(DRIZZLE_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO rakshex_schema_migrations (tag) VALUES ($1)`, [tag]);
        await client.query("COMMIT");
        applied.push(tag);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.end();
  }

  return applied;
}

export async function listMigrations(): Promise<{
  expected: string[];
  applied: string[];
}> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return { expected: MIGRATION_ORDER.map((f) => f.replace(/\.sql$/, "")), applied: [] };
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rakshex_schema_migrations (
        id serial PRIMARY KEY,
        tag text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    const { rows } = await client.query<{ tag: string }>(
      `SELECT tag FROM rakshex_schema_migrations ORDER BY id ASC`,
    );
    return {
      expected: MIGRATION_ORDER.map((f) => f.replace(/\.sql$/, "")),
      applied: rows.map((r) => r.tag),
    };
  } finally {
    await client.end();
  }
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("/migrate.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("/migrate.js");

if (isMain) {
  migrate()
    .then((applied) => {
      if (applied.length === 0) {
        console.log("[migrate] Database already up to date");
      } else {
        console.log("[migrate] Applied:", applied.join(", "));
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate] Failed:", err);
      process.exit(1);
    });
}
