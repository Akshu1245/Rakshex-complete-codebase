/**
 * Integration tests for PostgreSQL foundation migrations, FKs, uniques, tenant scope.
 *
 * Requires DATABASE_URL (or uses local default). Skips if Postgres is unreachable.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createHash, randomBytes } from "node:crypto";
import { migrate } from "./migrate.js";
import { resetDatabase } from "./reset.js";
import { seed, SEED_FIXTURES } from "./seed.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex";

function rid(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function canConnect(): Promise<boolean> {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

const available = await canConnect();

describe.skipIf(!available)("PostgreSQL foundation", () => {
  let client: pg.Client;

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    process.env.RAKSHEX_ALLOW_DB_RESET = "1";
    await resetDatabase(DATABASE_URL);
    await seed(DATABASE_URL);
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
  }, 120_000);

  afterAll(async () => {
    await client?.end();
  });

  it("migrates from zero and records all tags", async () => {
    const { rows } = await client.query<{ tag: string }>(
      `SELECT tag FROM rakshex_schema_migrations ORDER BY id`,
    );
    const tags = rows.map((r) => r.tag);
    expect(tags).toContain("0000_curly_dark_phoenix");
    expect(tags).toContain("0007_market_ready_foundation");
    expect(tags.length).toBeGreaterThanOrEqual(8);
  });

  it("idempotent migrate applies nothing when up to date", async () => {
    const applied = await migrate(DATABASE_URL);
    expect(applied).toEqual([]);
  });

  it("seed creates synthetic local user and workspace (no real PII domains)", async () => {
    const { rows } = await client.query(
      `SELECT u.email, w.slug FROM users u
       JOIN workspaces w ON w."ownerUserId" = u.id
       WHERE u."openId" = $1`,
      [SEED_FIXTURES.user.openId],
    );
    expect(rows[0]?.email).toBe("dev.user@example.local");
    expect(rows[0]?.slug).toBe("local-dev");
    expect(String(rows[0]?.email)).toMatch(/\.local$/);
  });

  it("enforces unique api key prefix", async () => {
    const { rows: ws } = await client.query<{ id: number }>(
      `SELECT id FROM workspaces WHERE slug = 'local-dev' LIMIT 1`,
    );
    const { rows: users } = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE "openId" = $1`,
      [SEED_FIXTURES.user.openId],
    );
    const workspaceId = ws[0]!.id;
    const userId = users[0]!.id;
    const prefix = `rk_test_${randomBytes(3).toString("hex")}`;

    await client.query(
      `INSERT INTO api_keys (id, workspace_id, created_by_user_id, name, key_prefix, key_hash, environment, scopes, created_at, updated_at)
       VALUES ($1, $2, $3, 'A', $4, $5, 'test', '[]'::json, now(), now())`,
      [rid("key"), workspaceId, userId, prefix, sha("a")],
    );

    await expect(
      client.query(
        `INSERT INTO api_keys (id, workspace_id, created_by_user_id, name, key_prefix, key_hash, environment, scopes, created_at, updated_at)
         VALUES ($1, $2, $3, 'B', $4, $5, 'test', '[]'::json, now(), now())`,
        [rid("key"), workspaceId, userId, prefix, sha("b")],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("enforces foreign key: api_keys.workspace_id must exist", async () => {
    const { rows: users } = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE "openId" = $1`,
      [SEED_FIXTURES.user.openId],
    );
    await expect(
      client.query(
        `INSERT INTO api_keys (id, workspace_id, created_by_user_id, name, key_prefix, key_hash, environment, scopes, created_at, updated_at)
         VALUES ($1, 99999999, $2, 'ghost', $3, $4, 'test', '[]'::json, now(), now())`,
        [rid("key"), users[0]!.id, `rk_x_${randomBytes(3).toString("hex")}`, sha("x")],
      ),
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("enforces unique project slug per workspace", async () => {
    const { rows: ws } = await client.query<{ id: number }>(
      `SELECT id FROM workspaces WHERE slug = 'local-dev'`,
    );
    const workspaceId = ws[0]!.id;
    const slug = `proj-${randomBytes(3).toString("hex")}`;
    await client.query(
      `INSERT INTO projects (id, workspace_id, name, slug, created_at, updated_at)
       VALUES ($1, $2, 'P1', $3, now(), now())`,
      [rid("prj"), workspaceId, slug],
    );
    await expect(
      client.query(
        `INSERT INTO projects (id, workspace_id, name, slug, created_at, updated_at)
         VALUES ($1, $2, 'P2', $3, now(), now())`,
        [rid("prj"), workspaceId, slug],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("tenant scoping: workspace-owned rows isolate by workspace_id", async () => {
    // Second workspace
    const { rows: users } = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE "openId" = $1`,
      [SEED_FIXTURES.user.openId],
    );
    const userId = users[0]!.id;
    const { rows: wsA } = await client.query<{ id: number }>(
      `SELECT id FROM workspaces WHERE slug = 'local-dev'`,
    );
    const workspaceA = wsA[0]!.id;

    const { rows: wsB } = await client.query<{ id: number }>(
      `INSERT INTO workspaces (slug, name, "ownerUserId", "isPersonal", "createdAt", "updatedAt")
       VALUES ($1, 'Other WS', $2, false, now(), now())
       RETURNING id`,
      [`other-${randomBytes(3).toString("hex")}`, userId],
    );
    const workspaceB = wsB[0]!.id;

    const policyA = rid("pol");
    const policyB = rid("pol");
    await client.query(
      `INSERT INTO policies (id, workspace_id, name, status, current_version, created_at, updated_at)
       VALUES ($1, $2, 'Policy A', 'draft', 0, now(), now())`,
      [policyA, workspaceA],
    );
    await client.query(
      `INSERT INTO policies (id, workspace_id, name, status, current_version, created_at, updated_at)
       VALUES ($1, $2, 'Policy B', 'draft', 0, now(), now())`,
      [policyB, workspaceB],
    );

    const { rows: onlyA } = await client.query(`SELECT id FROM policies WHERE workspace_id = $1`, [
      workspaceA,
    ]);
    const idsA = onlyA.map((r) => r.id as string);
    expect(idsA).toContain(policyA);
    expect(idsA).not.toContain(policyB);

    const { rows: onlyB } = await client.query(`SELECT id FROM policies WHERE workspace_id = $1`, [
      workspaceB,
    ]);
    expect(onlyB.map((r) => r.id)).toContain(policyB);
    expect(onlyB.map((r) => r.id)).not.toContain(policyA);
  });

  it("agent_steps FK cascades with agent_runs", async () => {
    const { rows: ws } = await client.query<{ id: number }>(
      `SELECT id FROM workspaces WHERE slug = 'local-dev'`,
    );
    const workspaceId = ws[0]!.id;
    const runId = rid("run");
    const stepId = rid("step");
    await client.query(
      `INSERT INTO agent_runs (id, workspace_id, agent_key, status, created_at, updated_at)
       VALUES ($1, $2, 'demo-agent', 'running', now(), now())`,
      [runId, workspaceId],
    );
    await client.query(
      `INSERT INTO agent_steps (id, workspace_id, agent_run_id, step_index, name, status, created_at)
       VALUES ($1, $2, $3, 1, 'plan', 'running', now())`,
      [stepId, workspaceId, runId],
    );
    await client.query(`DELETE FROM agent_runs WHERE id = $1`, [runId]);
    const { rows } = await client.query(`SELECT id FROM agent_steps WHERE id = $1`, [stepId]);
    expect(rows).toHaveLength(0);
  });

  it("workspace_members unique (workspace, user)", async () => {
    const { rows: ws } = await client.query<{ id: number }>(
      `SELECT id FROM workspaces WHERE slug = 'local-dev'`,
    );
    const { rows: users } = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE "openId" = $1`,
      [SEED_FIXTURES.user.openId],
    );
    await expect(
      client.query(
        `INSERT INTO workspace_members ("workspaceId", "userId", role, active, "joinedAt")
         VALUES ($1, $2, 'viewer', true, now())`,
        [ws[0]!.id, users[0]!.id],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});

describe("foundation unit (no DB)", () => {
  it("exports SEED_FIXTURES without real email domains", () => {
    expect(SEED_FIXTURES.user.email).toMatch(/@example\.local$/);
  });
});
