/**
 * RaksHexBench — PostgreSQL evidence tests for the money path.
 *
 * This intentionally exercises the real DB conditional update in
 * reserveGatewayBudget rather than a mocked repository. It proves that a
 * burst of concurrent requests cannot push a hard budget above its limit and
 * that release/settlement reconciliation remains exact.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { migrate } from "@rakshex/database";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://rakshex:password@localhost:5432/rakshex";

async function canConnect(): Promise<boolean> {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2_000 });
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
      // connectivity probe only
    }
  }
}

async function ensureBenchWorkspace(client: pg.Client): Promise<number> {
  const slug = "rakshexbench-budget-ws";
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const nonce = randomBytes(6).toString("hex");
  const user = await client.query<{ id: number }>(
    `INSERT INTO users ("openId", name, email, role, plan, "createdAt", "updatedAt")
     VALUES ($1, 'RaksHexBench', $2, 'user', 'free', now(), now())
     RETURNING id`,
    [`bench_${nonce}`, `rakshexbench_${nonce}@example.local`],
  );
  const ownerUserId = user.rows[0]?.id;
  if (!ownerUserId) throw new Error("failed to create RaksHexBench user");

  const workspace = await client.query<{ id: number }>(
    `INSERT INTO workspaces (slug, name, "ownerUserId", "isPersonal", "createdAt", "updatedAt")
     VALUES ($1, 'RaksHexBench', $2, false, now(), now())
     RETURNING id`,
    [slug, ownerUserId],
  );
  const workspaceId = workspace.rows[0]?.id;
  if (!workspaceId) throw new Error("failed to create RaksHexBench workspace");
  return workspaceId;
}

const available = await canConnect();

describe.skipIf(!available)("RaksHexBench: atomic gateway budget", () => {
  let client: pg.Client;
  let workspaceId = 0;
  let reserveGatewayBudget: typeof import("./teamGovernance").reserveGatewayBudget;
  let settleGatewayBudget: typeof import("./teamGovernance").settleGatewayBudget;

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    vi.resetModules();
    const governance = await import("./teamGovernance");
    reserveGatewayBudget = governance.reserveGatewayBudget;
    settleGatewayBudget = governance.settleGatewayBudget;

    await migrate(DATABASE_URL);
    client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    workspaceId = await ensureBenchWorkspace(client);
  }, 120_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM team_ai_budgets WHERE workspace_id = $1`, [workspaceId]);
    await client.end();
  });

  async function resetWorkspaceBudget(limitUsd: number) {
    await client.query(`DELETE FROM team_ai_budgets WHERE workspace_id = $1`, [workspaceId]);
    await client.query(
      `INSERT INTO team_ai_budgets
        (workspace_id, identity_id, period, limit_usd, warning_pct, hard_limit,
         enforcement_mode, current_spend_usd, created_at, updated_at)
       VALUES ($1, NULL, 'monthly', $2, 80, true, 'gateway', 0, now(), now())`,
      [workspaceId, limitUsd],
    );
  }

  async function currentSpend(): Promise<number> {
    const result = await client.query<{ current_spend_usd: string }>(
      `SELECT current_spend_usd::text AS current_spend_usd
       FROM team_ai_budgets
       WHERE workspace_id = $1 AND identity_id IS NULL
       LIMIT 1`,
      [workspaceId],
    );
    return Number(result.rows[0]?.current_spend_usd ?? 0);
  }

  const levels = [
    { concurrent: 10, amountUsd: 1, limitUsd: 5, expectedAllowed: 5 },
    { concurrent: 100, amountUsd: 0.1, limitUsd: 5, expectedAllowed: 50 },
    { concurrent: 1_000, amountUsd: 0.01, limitUsd: 5, expectedAllowed: 500 },
  ] as const;

  for (const level of levels) {
    it(`never overspends under ${level.concurrent} concurrent reservations`, async () => {
      await resetWorkspaceBudget(level.limitUsd);

      const results = await Promise.all(
        Array.from({ length: level.concurrent }, () =>
          reserveGatewayBudget({
            workspaceId,
            estimatedCostUsd: level.amountUsd,
          }),
        ),
      );

      const allowed = results.filter(
        (result): result is Extract<typeof result, { allowed: true }> => result.allowed,
      );
      const blocked = results.filter((result) => !result.allowed);

      expect(allowed).toHaveLength(level.expectedAllowed);
      expect(blocked).toHaveLength(level.concurrent - level.expectedAllowed);
      expect(await currentSpend()).toBeCloseTo(level.limitUsd, 6);

      await Promise.all(allowed.map((result) => settleGatewayBudget(result.reservation, 0)));
      expect(await currentSpend()).toBeCloseTo(0, 6);
    }, 120_000);
  }

  it("reconciles reserved estimate down to actual provider cost", async () => {
    await resetWorkspaceBudget(10);
    const result = await reserveGatewayBudget({
      workspaceId,
      estimatedCostUsd: 2,
    });
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;

    expect(await currentSpend()).toBeCloseTo(2, 6);
    await settleGatewayBudget(result.reservation, 0.25);
    expect(await currentSpend()).toBeCloseTo(0.25, 6);
  });
});
