/**
 * Disposable CI-only Agent Firewall PostgreSQL/Redis outage probe.
 *
 * The GitHub Actions job provisions its own containers and test tenant.
 * This file NEVER stops services; the workflow owns container lifecycle.
 * Refuses production or remote DATABASE_URL values.
 */
import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { generateCsrfToken } from "../utils/security";
import { actionLedger, users, workspaceMembers, workspaces } from "@rakshex/database";
import { and, eq } from "drizzle-orm";

type Fixture = {
  workspaceId: number;
  userId: number;
  agentId: string;
  capabilityToken: string;
};

const phase = process.argv[2];
const fixturePath = process.env.RAKSHEX_CHAOS_FIXTURE_PATH ?? "/tmp/rakshex-chaos-fixture.json";
const databaseUrl = process.env.DATABASE_URL ?? "";
const connection = new URL(databaseUrl);
if (
  process.env.CI !== "true" ||
  process.env.RAKSHEX_CHAOS_STAGING_ONLY !== "1" ||
  process.env.NODE_ENV === "production" ||
  connection.hostname !== "127.0.0.1" ||
  connection.port !== "5434" ||
  connection.pathname !== "/rakshex_chaos"
) {
  throw new Error("Refusing outage probe outside the dedicated disposable CI PostgreSQL instance");
}

function callerFor(userId: number) {
  const csrf = generateCsrfToken();
  const ctx = {
    user: {
      id: userId,
      openId: `local:chaos-${userId}`,
      email: "chaos@example.invalid",
      name: "Chaos Tester",
      role: "admin",
      plan: "free",
    },
    req: {
      protocol: "https",
      headers: { cookie: `csrf-token=${csrf}`, "x-csrf-token": csrf },
      ip: "127.0.0.1",
    },
    res: { clearCookie: () => undefined, getHeader: () => undefined, cookie: () => undefined },
  } as never;
  return appRouter.createCaller(ctx);
}

async function seed(): Promise<void> {
  const database = await getDb();
  if (!database) throw new Error("disposable database unavailable");
  const suffix = crypto.randomBytes(6).toString("hex");
  const [user] = await database
    .insert(users)
    .values({
      openId: `local:chaos-${suffix}`,
      email: `chaos-${suffix}@example.invalid`,
      name: "Chaos",
      role: "admin",
    })
    .returning({ id: users.id });
  if (!user) throw new Error("Could not create test user");
  const [workspace] = await database
    .insert(workspaces)
    .values({ slug: `chaos-${suffix}`, name: "Disposable Chaos Test", ownerUserId: user.id })
    .returning({ id: workspaces.id });
  if (!workspace) throw new Error("Could not create test workspace");
  await database.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
    active: true,
    joinedAt: new Date(),
  });
  const caller = callerFor(user.id);
  const agent = await caller.agentFirewall.identities.create({
    workspaceId: workspace.id,
    agentKey: `chaos-agent-${suffix}`,
    name: "Chaos Probe Agent",
    environment: "production",
    mode: "enforce",
    capabilities: ["financial.refund"],
  });
  const authority = await caller.agentFirewall.authorities.create({
    workspaceId: workspace.id,
    agentId: agent.id,
    scope: { actions: ["financial.refund"], resources: ["test:*"], environments: ["production"] },
  });
  const fixture: Fixture = {
    workspaceId: workspace.id,
    userId: user.id,
    agentId: agent.id,
    capabilityToken: authority.capabilityToken,
  };
  writeFileSync(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
  console.log(JSON.stringify({ phase: "seed", workspaceId: workspace.id, result: "ready" }));
}

async function probe(): Promise<void> {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
  const input = {
    workspaceId: fixture.workspaceId,
    agentId: fixture.agentId,
    capabilityToken: fixture.capabilityToken,
    idempotencyKey: crypto.randomUUID(),
    provider: "stripe",
    operation: "refunds.create",
    resource: "test:isolated",
    environment: "production",
    amountMinor: 0,
    currency: "USD",
  };
  const started = performance.now();
  let verdict = "ERROR";
  let ledgerId: string | undefined;
  try {
    const result = await callerFor(fixture.userId).agentFirewall.evaluate(input);
    verdict = result.effectiveDecision;
    ledgerId = "ledgerId" in result ? result.ledgerId : result.id;
    if (phase === "postgres_down") {
      throw new Error(`Postgres down returned a decision: ${verdict}`);
    }
    if (verdict !== "ALLOW" || !ledgerId) {
      throw new Error(`Expected persisted ALLOW, got ${verdict}`);
    }
    // Redis failure must never produce an unpersisted ALLOW.
    const database = await getDb();
    if (!database) throw new Error("No database after ALLOW");
    const stored = await database
      .select({ id: actionLedger.id })
      .from(actionLedger)
      .where(and(eq(actionLedger.workspaceId, fixture.workspaceId), eq(actionLedger.id, ledgerId)))
      .limit(1);
    if (stored.length !== 1) throw new Error("ALLOW was not persisted in PostgreSQL");
  } catch (error) {
    if (phase !== "postgres_down") throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("Postgres down returned a decision:")) throw error;
    verdict = "REJECTED";
  }
  console.log(
    JSON.stringify({
      phase,
      result: verdict,
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      note: "single local caller probe, not k6 p99",
    }),
  );
}

async function main() {
  if (phase === "seed") await seed();
  else if (
    ["postgres_healthy", "postgres_down", "postgres_recovered", "redis_down"].includes(phase ?? "")
  )
    await probe();
  else
    throw new Error(
      "Usage: tsx chaos/dbOutage.ts seed|postgres_healthy|postgres_down|postgres_recovered|redis_down",
    );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
