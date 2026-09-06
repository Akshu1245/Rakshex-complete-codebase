/**
 * PostgreSQL integration tests for adaptive team pool budget reservation.
 * Skips when DATABASE_URL / Postgres is unreachable.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { migrate } from "@rakshex/database";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://rakshex:password@localhost:5432/rakshex";

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

async function ensureTestWorkspace(client: pg.Client): Promise<number> {
  const slug = "pool-itest-ws";
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const openId = `pool_itest_${randomBytes(6).toString("hex")}`;
  const user = await client.query<{ id: number }>(
    `INSERT INTO users ("openId", name, email, role, plan, "createdAt", "updatedAt")
     VALUES ($1, 'Pool Integration', 'pool@example.local', 'user', 'free', now(), now())
     RETURNING id`,
    [openId],
  );
  const ownerUserId = user.rows[0]?.id;
  if (!ownerUserId) throw new Error("failed to create pool integration test user");

  const workspace = await client.query<{ id: number }>(
    `INSERT INTO workspaces (slug, name, "ownerUserId", "isPersonal", "createdAt", "updatedAt")
     VALUES ($1, 'Pool Integration Test', $2, false, now(), now())
     RETURNING id`,
    [slug, ownerUserId],
  );
  const workspaceId = workspace.rows[0]?.id;
  if (!workspaceId) throw new Error("failed to create pool integration test workspace");
  return workspaceId;
}

const available = await canConnect();

describe.skipIf(!available)("reserveGatewayBudget pool integration", () => {
  let client: pg.Client;
  let workspaceId = 0;
  let reserveGatewayBudget: typeof import("./teamGovernance").reserveGatewayBudget;
  let settleGatewayBudget: typeof import("./teamGovernance").settleGatewayBudget;
  const identityBorrower = 880001;
  const identityLender = 880002;

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    vi.resetModules();
    const gov = await import("./teamGovernance");
    reserveGatewayBudget = gov.reserveGatewayBudget;
    settleGatewayBudget = gov.settleGatewayBudget;

    await migrate(DATABASE_URL);
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    workspaceId = await ensureTestWorkspace(client);

    await client.query(`DELETE FROM team_ai_budgets WHERE workspace_id = $1`, [workspaceId]);

    await client.query(
      `INSERT INTO team_ai_budgets
        (workspace_id, identity_id, period, limit_usd, warning_pct, hard_limit, enforcement_mode, current_spend_usd, metadata, created_at, updated_at)
       VALUES
        ($1, NULL, 'monthly', 100, 80, true, 'gateway', 100, $2, now(), now()),
        ($1, $3, 'monthly', 5, 80, true, 'gateway', 5, $4, now(), now()),
        ($1, $5, 'monthly', 40, 80, true, 'gateway', 5, $6, now(), now())`,
      [
        workspaceId,
        JSON.stringify({
          pool: {
            enabled: true,
            mode: "shareable",
            maxBorrowUsd: 25,
            approvalThresholdUsd: 20,
            emergencyMinPriority: "critical",
            emergencyReserveUsd: 0,
          },
        }),
        identityBorrower,
        JSON.stringify({ shareable: true, protectedUsd: 0 }),
        identityLender,
        JSON.stringify({ shareable: true, protectedUsd: 10 }),
      ],
    );
  }, 120_000);

  afterAll(async () => {
    if (client) {
      await client.query(`DELETE FROM team_ai_budgets WHERE workspace_id = $1`, [workspaceId]);
      await client.end();
    }
  });

  it("borrows shareable teammate capacity when personal and team budgets are exhausted", async () => {
    const result = await reserveGatewayBudget({
      workspaceId,
      identityId: identityBorrower,
      estimatedCostUsd: 2,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.reservation?.poolPlan?.borrowedUsd).toBe(2);
    expect(result.reservation?.slices.length).toBeGreaterThanOrEqual(1);

    await settleGatewayBudget(result.reservation, 2);

    const { rows } = await client.query<{ identity_id: number | null; current_spend_usd: string }>(
      `SELECT identity_id, current_spend_usd::text AS current_spend_usd
       FROM team_ai_budgets
       WHERE workspace_id = $1 AND identity_id = $2`,
      [workspaceId, identityLender],
    );
    expect(Number(rows[0]?.current_spend_usd)).toBe(7);
  });

  it("blocks when adaptive pool capacity is insufficient", async () => {
    const result = await reserveGatewayBudget({
      workspaceId,
      identityId: identityBorrower,
      estimatedCostUsd: 100,
    });

    if (result.allowed !== false) {
      throw new Error("expected pool reservation to be blocked");
    }
    expect(result.reason).toMatch(/pool|budget|shortfall/i);
  });
});
