/**
 * Agent Firewall — authenticated end-to-end path.
 *
 * Everything else about the firewall is tested in isolation: the decision
 * engine in @rakshex/action-control, the broker's authorization logic in
 * services/credentialBroker.test.ts, the wire behaviour in
 * credentialBroker.network.test.ts. What none of those cover is the *seam* —
 * whether a real signed-in caller can go
 *
 *   register agent -> issue authority -> evaluate() -> attempt to broker
 *
 * through the actual tRPC router (auth, CSRF, RBAC, Zod, DB) and whether the
 * enforcement properties survive being wired together. That is where a
 * per-piece-correct system usually turns out to be broken.
 *
 * ── On what is deliberately NOT asserted here ───────────────────────────────
 * This file drives the router via `createCaller` and a loopback upstream, so
 * every broker attempt below is refused by the SSRF/private-host guard. That
 * is a property of the design rather than a gap: a bypass flag on an SSRF
 * control is exactly the kind of flag that survives into production. The
 * successful ALLOW → broker → egress-row path (real HTTP sign-in, public
 * hostname, no SSRF bypass) lives in `agentFirewall.broker.http.test.ts`.
 * Real-socket injection/redirect behaviour stays in
 * credentialBroker.network.test.ts; replay stays on the DB unique index.
 *
 * What that leaves — and what this file proves end to end — is every
 * authorization decision between a signed-in user and the secret:
 *   - a DENY recorded by evaluate() cannot be spent at the broker
 *   - a loopback / non-registered origin is refused even with a valid ALLOW
 *   - a revoked credential is refused
 *   - the stored secret is never returned by any endpoint
 *
 * Requires DATABASE_URL and RAKSHEX_VAULT_KEY. Skips only when DATABASE_URL
 * is unset (unit runs). If DATABASE_URL is set without a vault key, this
 * file fails rather than skip — that was how CI used to silently miss the
 * whole suite.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import {
  agentIdentities,
  brokeredCredentials,
  credentialEgressLog,
  delegatedAuthorities,
  users,
  workspaceMembers,
  workspaces,
} from "@rakshex/database";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { generateCsrfToken } from "../utils/security";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const HAS_VAULT = Boolean((process.env.RAKSHEX_VAULT_KEY ?? "").trim().length >= 32);
if (HAS_DB && !HAS_VAULT) {
  throw new Error(
    "DATABASE_URL is set but RAKSHEX_VAULT_KEY is missing or shorter than 32 characters. " +
      "The Agent Firewall e2e suite will not skip in a DB-configured environment — " +
      "set a test-only vault key (see .env.example).",
  );
}
const RUN = HAS_DB && HAS_VAULT;
const d = RUN ? describe : describe.skip;

const SECRET = "fixture-e2e-provider-secret-value";

/** Stand-in upstream. Any hit here is a bug: the guard should stop us first. */
let upstream: Server;
let upstreamOrigin = "";
let upstreamHits = 0;

let workspaceId = 0;
let userId = 0;
let agentId = "";
let credentialId = "";
let capabilityToken = "";

function ctxFor(uid: number) {
  // Mutations pass through the CSRF middleware, which compares the
  // `x-csrf-token` header against the `csrf-token` cookie. Supplying a
  // matching pair is what a real browser session does — the point is to get
  // past it legitimately, not to bypass it.
  const csrfToken = generateCsrfToken();
  return {
    user: {
      id: uid,
      openId: `local:e2e-${uid}`,
      email: "e2e@example.com",
      name: "E2E",
      role: "admin",
      plan: "free",
    },
    req: {
      protocol: "https",
      headers: { cookie: `csrf-token=${csrfToken}`, "x-csrf-token": csrfToken },
      ip: "127.0.0.1",
    },
    res: { clearCookie: () => undefined, getHeader: () => undefined, cookie: () => undefined },
  } as never;
}

const caller = () => appRouter.createCaller(ctxFor(userId));
const idem = () => crypto.randomBytes(16).toString("hex");

/**
 * Issue a decision and normalize the result.
 *
 * `evaluate()` returns a union: a fresh decision carries `ledgerId`, while an
 * idempotency-key replay returns the stored ledger row, where the same value
 * is `id`. Every call here uses a unique key so the fresh branch is always
 * taken, but the union still has to be narrowed for the type checker — and
 * reading it wrong would silently pass `undefined` as a ledger id.
 */
async function freshAllow(amountMinor = 1_000): Promise<{
  ledgerId: string;
  decision: string;
  effectiveDecision: string;
}> {
  const result = (await caller().agentFirewall.evaluate({
    workspaceId,
    agentId,
    capabilityToken,
    idempotencyKey: idem(),
    provider: "e2e",
    operation: "refund.create",
    resource: "customer:1827",
    environment: "production",
    amountMinor,
    currency: "INR",
  })) as unknown as {
    ledgerId?: string;
    id?: string;
    decision: string;
    effectiveDecision: string;
  };
  const ledgerId = result.ledgerId ?? result.id;
  if (!ledgerId) throw new Error("evaluate() returned no ledger id");
  return { ledgerId, decision: result.decision, effectiveDecision: result.effectiveDecision };
}

beforeAll(async () => {
  if (!RUN) return;

  upstream = createServer((_req, res) => {
    upstreamHits += 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const addr = upstream.address();
  if (!addr || typeof addr === "string") throw new Error("upstream bind failed");
  upstreamOrigin = `https://127.0.0.1:${addr.port}`;

  const db = await getDb();
  if (!db) throw new Error("no database");

  const suffix = Math.random().toString(36).slice(2, 10);
  const [u] = await db
    .insert(users)
    .values({
      openId: `local:e2e-${suffix}`,
      email: `e2e-${suffix}@example.com`,
      name: "E2E User",
      role: "admin",
    })
    .returning({ id: users.id });
  userId = u!.id;

  const [w] = await db
    .insert(workspaces)
    .values({ slug: `e2e-${suffix}`, name: "E2E Workspace", ownerUserId: userId })
    .returning({ id: workspaces.id });
  workspaceId = w!.id;

  await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role: "owner", active: true, joinedAt: new Date() });
});

afterAll(async () => {
  if (!RUN) return;
  await new Promise<void>((resolve) => upstream?.close(() => resolve()));
  const db = await getDb();
  if (!db || !workspaceId) return;
  await db.delete(credentialEgressLog).where(eq(credentialEgressLog.workspaceId, workspaceId));
  await db.delete(brokeredCredentials).where(eq(brokeredCredentials.workspaceId, workspaceId));
  await db.delete(delegatedAuthorities).where(eq(delegatedAuthorities.workspaceId, workspaceId));
  await db.delete(agentIdentities).where(eq(agentIdentities.workspaceId, workspaceId));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(users).where(eq(users.id, userId));
});

d("Agent Firewall — authenticated end-to-end", () => {
  it("registers an agent in enforce mode", async () => {
    const agent = await caller().agentFirewall.identities.create({
      workspaceId,
      agentKey: `e2e-agent-${Math.random().toString(36).slice(2, 8)}`,
      name: "E2E Refund Agent",
      environment: "production",
      mode: "enforce",
      capabilities: ["financial.refund"],
    });
    agentId = (agent as { id: string }).id;
    expect(agentId).toBeTruthy();
  });

  it("issues a delegated authority scoped to refunds", async () => {
    const result = await caller().agentFirewall.authorities.create({
      workspaceId,
      agentId,
      scope: {
        actions: ["financial.refund"],
        resources: ["customer:*"],
        environments: ["production"],
        maxAmountMinor: 500_000,
        currency: "INR",
      },
    });
    capabilityToken = (result as { capabilityToken: string }).capabilityToken;
    // Shown exactly once, at issuance.
    expect(capabilityToken.startsWith("rk_cap_")).toBe(true);
  });

  it("stores a brokered credential and never returns the secret", async () => {
    const created = await caller().agentFirewall.credentials.create({
      workspaceId,
      name: "E2E upstream",
      provider: "e2e",
      secret: SECRET,
      allowedActions: ["financial.refund"],
      allowedOrigin: upstreamOrigin,
      injection: "bearer",
    });
    credentialId = (created as { credentialId: string }).credentialId;
    expect(credentialId).toBeTruthy();
    expect(JSON.stringify(created)).not.toContain(SECRET);

    const listed = await caller().agentFirewall.credentials.list({ workspaceId });
    // The whole point of mediation: the secret cannot be read back out.
    expect(JSON.stringify(listed)).not.toContain(SECRET);
    expect(JSON.stringify(listed)).not.toContain("secretCiphertext");
  });

  it("evaluates an in-scope action as ALLOW and an over-limit one as DENY", async () => {
    const allowed = await freshAllow(100_000);
    expect(allowed.decision).toBe("ALLOW");
    expect(allowed.effectiveDecision).toBe("ALLOW");

    const denied = await freshAllow(900_000); // over maxAmountMinor
    expect(denied.decision).toBe("DENY");
    expect(denied.effectiveDecision).toBe("DENY");
  });

  it("refuses to broker a DENIED action, and makes no upstream call", async () => {
    const denied = await freshAllow(900_000);
    expect(denied.effectiveDecision).toBe("DENY");

    const before = upstreamHits;
    await expect(
      caller().agentFirewall.credentials.broker({
        workspaceId,
        credentialId,
        ledgerId: denied.ledgerId,
        method: "POST",
        targetUrl: `${upstreamOrigin}/v1/refunds`,
        body: { amount: 900_000 },
      }),
    ).rejects.toThrow();
    expect(upstreamHits).toBe(before);
  });

  it("refuses a loopback target even with a valid ALLOW (SSRF guard)", async () => {
    const allowed = await freshAllow();
    expect(allowed.effectiveDecision).toBe("ALLOW");

    const before = upstreamHits;
    await expect(
      caller().agentFirewall.credentials.broker({
        workspaceId,
        credentialId,
        ledgerId: allowed.ledgerId,
        method: "POST",
        targetUrl: `${upstreamOrigin}/v1/refunds`,
        body: {},
      }),
    ).rejects.toThrow();
    // A valid authorization is still not enough to reach a private host.
    expect(upstreamHits).toBe(before);
  });

  it("refuses an origin the credential was not registered for", async () => {
    const allowed = await freshAllow();
    await expect(
      caller().agentFirewall.credentials.broker({
        workspaceId,
        credentialId,
        ledgerId: allowed.ledgerId,
        method: "POST",
        targetUrl: "https://api.stripe.com/v1/refunds",
        body: {},
      }),
    ).rejects.toThrow();
  });

  it("refuses a ledger record belonging to another workspace", async () => {
    const allowed = await freshAllow();
    await expect(
      caller().agentFirewall.credentials.broker({
        workspaceId: workspaceId + 99_999,
        credentialId,
        ledgerId: allowed.ledgerId,
        method: "POST",
        targetUrl: `${upstreamOrigin}/v1/refunds`,
        body: {},
      }),
    ).rejects.toThrow();
  });

  it("writes a hash-chained ledger record for every decision", async () => {
    const first = await freshAllow();
    const second = await freshAllow();
    expect(first.ledgerId).not.toBe(second.ledgerId);

    // ledger.list returns the rows directly, not wrapped in an envelope.
    const rows = (await caller().agentFirewall.ledger.list({
      workspaceId,
      limit: 50,
    })) as Array<{ id: string; recordHash: string | null }>;
    const found = rows.filter((r) => r.id === first.ledgerId || r.id === second.ledgerId);
    expect(found).toHaveLength(2);
    for (const row of found) expect(row.recordHash).toBeTruthy();
  });

  it("refuses a revoked credential", async () => {
    await caller().agentFirewall.credentials.revoke({ workspaceId, credentialId });
    const allowed = await freshAllow();
    const before = upstreamHits;
    await expect(
      caller().agentFirewall.credentials.broker({
        workspaceId,
        credentialId,
        ledgerId: allowed.ledgerId,
        method: "POST",
        targetUrl: `${upstreamOrigin}/v1/refunds`,
        body: {},
      }),
    ).rejects.toThrow();
    expect(upstreamHits).toBe(before);
  });

  it("never hit the upstream at any point in this suite", () => {
    // Every brokered attempt above should have been refused before egress.
    expect(upstreamHits).toBe(0);
  });
});

d("Agent Firewall — runtime key scope for ledger.outcome (regression)", () => {
  // Reproduces and proves the fix for a scope-model mismatch: `evaluate` and
  // `credentials.broker` both authorize a runtime call via
  // assertRuntimeApiKeyScope(ctx.user, workspaceId, "agent:execute") — the
  // scope carried by the API key itself, independent of the underlying
  // user's workspace RBAC role. `ledger.outcome` used to instead require
  // the full `security:write` RBAC permission (minimum role: security_lead,
  // rank 5), which a "developer" role (rank 3) does not have even though
  // developer is a perfectly reasonable role to own a scoped, agent:execute
  // -only runtime key under. Since AgentFirewallClient.recordOutcome() in
  // the SDK is called with the exact same key that called evaluate(), and
  // authorizeAndRun()'s success path awaits it uncaught, that mismatch made
  // the SDK's own happy path throw after a successfully executed action.
  let devUserId = 0;

  beforeAll(async () => {
    if (!RUN) return;
    const db = await getDb();
    if (!db) throw new Error("no database");
    const suffix = Math.random().toString(36).slice(2, 10);
    const [u] = await db
      .insert(users)
      .values({
        openId: `local:e2e-dev-${suffix}`,
        email: `e2e-dev-${suffix}@example.com`,
        name: "E2E Developer",
        role: "user",
      })
      .returning({ id: users.id });
    devUserId = u!.id;
    await db.insert(workspaceMembers).values({
      workspaceId,
      userId: devUserId,
      role: "developer",
      active: true,
      joinedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (!RUN || !devUserId) return;
    const db = await getDb();
    if (!db) return;
    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, devUserId));
    await db.delete(users).where(eq(users.id, devUserId));
  });

  function scopedAgentKeyCaller() {
    const csrfToken = generateCsrfToken();
    const ctx = {
      user: {
        id: devUserId,
        openId: `local:e2e-dev-${devUserId}`,
        email: "e2e-dev@example.com",
        name: "E2E Developer",
        role: "member",
        plan: "free",
        __apiKeyAuth: { keyId: "e2e-key", workspaceId, scopes: ["agent:execute"] },
      },
      req: {
        protocol: "https",
        headers: { cookie: `csrf-token=${csrfToken}`, "x-csrf-token": csrfToken },
        ip: "127.0.0.1",
      },
      res: { clearCookie: () => undefined, getHeader: () => undefined, cookie: () => undefined },
    } as never;
    return appRouter.createCaller(ctx);
  }

  it("a developer-role member with an agent:execute-only key can still record an outcome", async () => {
    // A "developer" role has rank 3, well under the security_lead (rank 5)
    // that `security:write` used to require — proving this isn't allowed
    // by accident via an elevated role, only via the key's own scope.
    const allowed = await freshAllow();
    expect(allowed.effectiveDecision).toBe("ALLOW");

    const result = await scopedAgentKeyCaller().agentFirewall.ledger.outcome({
      workspaceId,
      ledgerId: allowed.ledgerId,
      status: "succeeded",
    });
    expect((result as { success: boolean }).success).toBe(true);
  });

  it("still refuses a key scoped to a different workspace", async () => {
    const allowed = await freshAllow();
    const csrfToken = generateCsrfToken();
    const wrongWorkspaceCtx = {
      user: {
        id: devUserId,
        openId: `local:e2e-dev-${devUserId}`,
        email: "e2e-dev@example.com",
        name: "E2E Developer",
        role: "member",
        plan: "free",
        __apiKeyAuth: {
          keyId: "e2e-key",
          workspaceId: workspaceId + 99_999,
          scopes: ["agent:execute"],
        },
      },
      req: {
        protocol: "https",
        headers: { cookie: `csrf-token=${csrfToken}`, "x-csrf-token": csrfToken },
        ip: "127.0.0.1",
      },
      res: { clearCookie: () => undefined, getHeader: () => undefined, cookie: () => undefined },
    } as never;
    await expect(
      appRouter.createCaller(wrongWorkspaceCtx).agentFirewall.ledger.outcome({
        workspaceId,
        ledgerId: allowed.ledgerId,
        status: "succeeded",
      }),
    ).rejects.toThrow();
  });
});
