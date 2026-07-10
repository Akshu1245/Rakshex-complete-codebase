#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for migrations" >&2
  exit 1
fi

node --input-type=module <<'NODE'
import { Client } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.resolve('drizzle');
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => /^\d+.*\.sql$/u.test(file))
  .sort();

if (migrationFiles.length === 0) {
  console.log('No SQL migrations found in drizzle/.');
  process.exit(0);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS "_rakshex_migrations" (
    "name" text PRIMARY KEY,
    "applied_at" timestamptz NOT NULL DEFAULT now()
  )
`);

for (const file of migrationFiles) {
  const alreadyApplied = await client.query(
    'SELECT 1 FROM "_rakshex_migrations" WHERE "name" = $1',
    [file],
  );

  if (alreadyApplied.rowCount) {
    console.log(`Skipping already-applied migration: ${file}`);
    continue;
  }

  const migrationPath = path.join(migrationsDir, file);
  const migrationSql = (await readFile(migrationPath, 'utf8')).replaceAll('--> statement-breakpoint', '');

  await client.query('BEGIN');
  try {
    await client.query(migrationSql);
    await client.query('INSERT INTO "_rakshex_migrations" ("name") VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied migration: ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed migration: ${file}`);
    throw error;
  }
}

await client.end();
NODE
