/**
 * Disposable CI-only evaluation harness. NOT a production HTTP server or a
 * production end-to-end latency benchmark: it invokes the actual app router
 * with the same authenticated caller fixture used by firewall E2E tests.
 *
 * Never bind beyond loopback. Never run against production/shared Postgres.
 * See docs/architecture/FAULT_TEST_ISOLATED.md.
 */
import crypto from "node:crypto";
import { createServer } from "node:http";
import { eq, sql } from "drizzle-orm";
import { appRouter } from "../../apps/api/routers";
import { getDb } from "../../apps/api/db";
import { generateCsrfToken } from "../../apps/api/utils/security";
import { users, workspaces, workspaceMembers } from "@rakshex/database";

const databaseUrl = process.env.DATABASE_URL ?? "";
const url = new URL(databaseUrl);
if (
  process.env.CI !== "true" ||
  process.env.RAKSHEX_PERF_STAGING_ONLY !== "1" ||
  process.env.NODE_ENV !== "test" ||
  !["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
  url.pathname !== "/rakshex_fault_ci" ||
  process.env.PORT !== "4789"
) {
  throw new Error("Refusing to start benchmark harness outside disposable CI Postgres");
}
const API_KEY = "rk_ci_local_only_not_real";
const port = 4789;
const database = await getDb();
if (!database) throw new Error("Disposable CI database not available");

const suffix = crypto.randomBytes(6).toString("hex");
const [user] = await database
  .insert(users)
  .values({
    openId: `local:perf-${suffix}`,
    email: `perf-${suffix}@example.test`,
    name: "Disposable CI Agent",
    role: "admin",
  })
  .returning({ id: users.id });
if (!user) throw new Error("Unable to seed disposable CI user");

const [workspace] = await database
  .insert(workspaces)
  .values({ slug: `perf-${suffix}`, name: "Disposable CI Workspace", ownerUserId: user.id })
  .returning({ id: workspaces.id });
if (!workspace) throw new Error("Unable to seed disposable CI workspace");
await database
  .insert(workspaceMembers)
  .values({ workspaceId: workspace.id, userId: user.id, role: "owner", active: true, joinedAt: new Date() });

function caller() {
  const csrfToken = generateCsrfToken();
  return appRouter.createCaller({
    user: {
      id: user!.id,
      openId: `local:perf-${suffix}`,
      email: `perf-${suffix}@example.test`,
      name: "Disposable CI Agent",
      role: "admin",
      plan: "free",
    },
    req: {
      protocol: "http",
      headers: {
        cookie: `csrf-token=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
      ip: "127.0.0.1",
    },
    res: {
      clearCookie: () => undefined,
      getHeader: () => undefined,
      cookie: () => undefined,
    },
  } as never);
}

const identity = await caller().agentFirewall.identities.create({
  workspaceId: workspace.id,
  agentKey: `ci-perf-${suffix}`,
  name: "Disposable CI Evaluator",
  environment: "staging",
  mode: "enforce",
  capabilities: ["financial.refund"],
});
const agentId = (identity as { id: string }).id;
const grant = await caller().agentFirewall.authorities.create({
  workspaceId: workspace.id,
  agentId,
  scope: { actions: ["financial.refund"], resources: ["perf:*"], environments: ["staging"] },
});
const capabilityToken = (grant as { capabilityToken: string }).capabilityToken;

const server = createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(data));
  };
  if (req.method === "GET" && req.url === "/__metadata") {
    send(200, { workspaceId: workspace.id, agentId, capabilityToken, apiKey: API_KEY });
    return;
  }
  if (req.method === "GET" && req.url === "/__database") {
    try {
      await database.execute(sql`SELECT 1`);
      send(200, { database: "ready" });
    } catch {
      send(503, { database: "unavailable" });
    }
    return;
  }
  if (req.method !== "POST" || req.url !== "/api/trpc/agentFirewall.evaluate") {
    send(404, { error: "not found" });
    return;
  }
  if (req.headers["x-api-key"] !== API_KEY) {
    send(401, { error: "disposable test API key required" });
    return;
  }
  let payload = "";
  for await (const part of req) {
    payload += part.toString();
    if (payload.length > 16_384) {
      send(413, { error: "request too large" });
      return;
    }
  }
  try {
    const parsed = JSON.parse(payload) as { json?: Record<string, unknown> };
    const fields = parsed.json ?? {};
    // Force tenant/agent/capability scoping to seeded disposable fixtures.
    if (
      fields.workspaceId !== workspace.id ||
      fields.agentId !== agentId ||
      fields.capabilityToken !== capabilityToken
    ) {
      send(403, { error: "wrong disposable benchmark scope" });
      return;
    }
    const decision = await caller().agentFirewall.evaluate(fields as never);
    send(200, { result: { data: { json: decision } } });
  } catch {
    // A failed database transaction must never be represented as ALLOW.
    send(503, { error: "evaluation unavailable" });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Disposable evaluator ready at http://127.0.0.1:${port}\n`);
});
