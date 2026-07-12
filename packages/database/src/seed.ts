/**
 * Local development seed — synthetic data only (no real PII).
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @rakshex/database db:seed
 */

import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Synthetic fixture — not a real person. */
export const SEED_FIXTURES = {
  user: {
    openId: "seed_user_local_dev_only",
    name: "Local Dev User",
    email: "dev.user@example.local",
  },
  workspace: {
    slug: "local-dev",
    name: "Local Dev Workspace",
  },
  project: {
    slug: "demo-api",
    name: "Demo API Project",
  },
} as const;

export async function seed(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for seed");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");

    // User
    const userRes = await client.query<{ id: number }>(
      `INSERT INTO users ("openId", name, email, "loginMethod", role, plan, "passwordHash", "scansRemaining", "onboardingCompleted", "createdAt", "updatedAt", "lastSignedIn")
       VALUES ($1, $2, $3, 'email', 'admin', 'free', $4, 100, true, now(), now(), now())
       ON CONFLICT ("openId") DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [
        SEED_FIXTURES.user.openId,
        SEED_FIXTURES.user.name,
        SEED_FIXTURES.user.email,
        hash("local-dev-password-not-for-production"),
      ],
    );
    const userId = userRes.rows[0]!.id;

    // Workspace
    const wsRes = await client.query<{ id: number }>(
      `INSERT INTO workspaces (slug, name, "ownerUserId", "isPersonal", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, now(), now())
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [SEED_FIXTURES.workspace.slug, SEED_FIXTURES.workspace.name, userId],
    );
    const workspaceId = wsRes.rows[0]!.id;

    await client.query(
      `INSERT INTO workspace_members ("workspaceId", "userId", role, active, "joinedAt")
       SELECT $1, $2, 'owner', true, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM workspace_members WHERE "workspaceId" = $1 AND "userId" = $2
       )`,
      [workspaceId, userId],
    );

    // Identity
    const identityId = id("idn");
    await client.query(
      `INSERT INTO identities (id, user_id, provider, provider_subject, email, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, 'email', $3, $4, now(), now(), now())
       ON CONFLICT DO NOTHING`,
      [identityId, userId, SEED_FIXTURES.user.openId, SEED_FIXTURES.user.email],
    );

    // Permissions + system role
    const permId = id("perm");
    await client.query(
      `INSERT INTO permissions (id, key, resource, action, description, created_at)
       VALUES ($1, 'collections.read', 'collections', 'read', 'Read collections', now())
       ON CONFLICT (key) DO NOTHING`,
      [permId],
    );
    const roleId = id("role");
    await client.query(
      `INSERT INTO roles (id, workspace_id, key, name, description, is_system, created_at, updated_at)
       VALUES ($1, NULL, 'owner', 'Owner', 'System owner role', true, now(), now())
       ON CONFLICT DO NOTHING`,
      [roleId],
    );

    // Project
    const projectId = id("prj");
    await client.query(
      `INSERT INTO projects (id, workspace_id, name, slug, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Synthetic demo project for local development', now(), now())
       ON CONFLICT DO NOTHING`,
      [projectId, workspaceId, SEED_FIXTURES.project.name, SEED_FIXTURES.project.slug],
    );

    // API key (hash only — secret never stored)
    const keyId = id("key");
    const prefix = "rk_live_seed";
    await client.query(
      `INSERT INTO api_keys (id, workspace_id, created_by_user_id, name, key_prefix, key_hash, environment, scopes, created_at, updated_at)
       VALUES ($1, $2, $3, 'Local Dev Key', $4, $5, 'test', '["scan","findings"]'::json, now(), now())
       ON CONFLICT DO NOTHING`,
      [keyId, workspaceId, userId, prefix, hash("rk_live_seed_local_only_secret")],
    );

    // Compliance framework sample
    const fwId = id("fw");
    await client.query(
      `INSERT INTO compliance_frameworks (id, key, name, version, description, created_at)
       VALUES ($1, 'owasp_api_top10', 'OWASP API Security Top 10', '2023', 'Seed framework for local demos', now())
       ON CONFLICT (key) DO NOTHING`,
      [fwId],
    );
    const controlId = id("ctl");
    await client.query(
      `INSERT INTO compliance_controls (id, framework_id, control_key, title, requirement, created_at)
       SELECT $1, id, 'API1', 'Broken Object Level Authorization', 'Enforce object-level authorization on every request', now()
       FROM compliance_frameworks WHERE key = 'owasp_api_top10'
       ON CONFLICT DO NOTHING`,
      [controlId],
    );

    // Pricing version sample (public list prices — not customer data)
    const pvId = id("pv");
    await client.query(
      `INSERT INTO pricing_versions (id, provider, model, region, currency, input_per_1m, output_per_1m, effective_from, created_at)
       VALUES ($1, 'openai', 'gpt-4o-mini', 'global', 'USD', 0.15, 0.60, now(), now())
       ON CONFLICT DO NOTHING`,
      [pvId],
    );

    await client.query("COMMIT");
    console.log("[seed] Local synthetic data ready");
    console.log(`  userId=${userId} workspaceId=${workspaceId} email=${SEED_FIXTURES.user.email}`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

const isCli = process.argv[1]?.includes("seed");
if (isCli) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] Failed:", err);
      process.exit(1);
    });
}
