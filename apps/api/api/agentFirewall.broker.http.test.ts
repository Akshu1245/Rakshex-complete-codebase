/**
 * Agent Firewall — authenticated HTTP broker path.
 *
 * CLAUDE.md §5 item 2: route existence and anonymous rejection were proven;
 * the full path (sign in → store credential → evaluate → broker → egress row)
 * was not. This file closes that gap by driving the real Express/tRPC adapter
 * over HTTP — cookies, CSRF double-submit, session JWT — rather than
 * `createCaller` with an injected user.
 *
 * Successful egress uses a public hostname (`https://broker-e2e.example`) so
 * the SSRF/private-host guard is actually satisfied. The upstream fetch is
 * intercepted on that origin only; loopback remains refused (covered by
 * agentFirewall.e2e.test.ts) and no test-only bypass is introduced. The
 * fixture secret never leaves this process.
 *
 * Requires DATABASE_URL and RAKSHEX_VAULT_KEY. Skips only when DATABASE_URL
 * is unset. If DATABASE_URL is set without a vault key, fails rather than skip.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import crypto from "node:crypto";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import {
  actionApprovals,
  actionLedger,
  agentIdentities,
  brokeredCredentials,
  credentialEgressLog,
  delegatedAuthorities,
  userSessions,
  users,
  workspaceMembers,
  workspaces,
} from "@rakshex/database";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";
import { getDb } from "../db";

const HAS_DB = Boolean(process.env.DATABASE_URL?.trim());
const HAS_VAULT = Boolean((process.env.RAKSHEX_VAULT_KEY ?? "").trim().length >= 32);
if (HAS_DB && !HAS_VAULT) {
  throw new Error(
    "DATABASE_URL is set but RAKSHEX_VAULT_KEY is missing or shorter than 32 characters. " +
      "The authenticated broker HTTP test will not skip in a DB-configured environment.",
  );
}
const RUN = HAS_DB && HAS_VAULT;
const d = RUN ? describe : describe.skip;

const SECRET = "fixture-http-broker-secret-not-a-real-key";
const UPSTREAM_ORIGIN = "https://broker-e2e.example";
const UPSTREAM_PATH = "/v1/refunds";

let server: Server;
let baseUrl = "";
let cookieJar = "";
let csrfToken = "";
let userId = 0;
let workspaceId = 0;

const capturedUpstream: Array<{ url: string; authorization: string | undefined; body: string }> =
  [];
const originalFetch = globalThis.fetch;

/**
 * Intercept only the fixture hostname. `startsWith(origin)` is incomplete URL
 * sanitization (`https://broker-e2e.example.evil.com` would match) and is
 * what CodeQL's new-alerts check flagged on this file. Origin equality is
 * the same check the broker uses for allowedOrigin.
 */
function isFixtureUpstream(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "https:" && parsed.hostname === "broker-e2e.example";
  } catch {
    return false;
  }
}

function headerValue(headers: HeadersInit | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const want = name.toLowerCase();
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (Array.isArray(headers)) {
    const hit = headers.find(([k]) => k.toLowerCase() === want);
    return hit?.[1];
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return v;
  }
  return undefined;
}

function mergeCookies(existing: string, setCookie: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const header of setCookie) {
    const pair = header.split(";")[0] ?? "";
    const i = pair.indexOf("=");
    if (i > 0) map.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function cookieValue(jar: string, name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = jar
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  return hit?.slice(prefix.length);
}

interface TrpcResult<T> {
  status: number;
  data: T | undefined;
  error: { message?: string; data?: { code?: string } } | undefined;
}

function unwrapError(envelope: unknown): TrpcResult<never>["error"] {
  if (!envelope || typeof envelope !== "object") return undefined;
  const rec = envelope as Record<string, unknown>;
  const err = rec.error;
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const inner = (e.json && typeof e.json === "object" ? e.json : e) as Record<string, unknown>;
  return {
    message: typeof inner.message === "string" ? inner.message : undefined,
    data: inner.data as { code?: string } | undefined,
  };
}

async function trpc<T>(
  path: string,
  input: unknown,
  opts: { cookies?: string; csrf?: string; type?: "query" | "mutation" } = {},
): Promise<TrpcResult<T>> {
  const cookies = opts.cookies ?? cookieJar;
  const csrf = opts.csrf ?? csrfToken;
  const type = opts.type ?? "mutation";
  const headers: Record<string, string> = {};
  if (cookies) headers.cookie = cookies;
  if (csrf) headers["x-csrf-token"] = csrf;

  let res: Response;
  if (type === "query") {
    const url = new URL(`/api/trpc/${path}`, baseUrl);
    if (input !== undefined) {
      url.searchParams.set("input", JSON.stringify(superjson.serialize(input)));
    }
    res = await originalFetch(url, { method: "GET", headers });
  } else {
    headers["content-type"] = "application/json";
    res = await originalFetch(`${baseUrl}/api/trpc/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(superjson.serialize(input ?? null)),
    });
  }

  const setCookie =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (setCookie.length) {
    cookieJar = mergeCookies(cookieJar, setCookie);
    csrfToken = cookieValue(cookieJar, "csrf-token") ?? csrfToken;
  }

  const body = (await res.json()) as unknown;
  const envelope = Array.isArray(body) ? body[0] : body;
  const record = envelope as { result?: { data?: unknown } };
  let data: T | undefined;
  if (record?.result?.data !== undefined) {
    try {
      data = superjson.deserialize(record.result.data as never) as T;
    } catch {
      data = record.result.data as T;
    }
  }
  return { status: res.status, data, error: unwrapError(envelope) };
}

async function trpcOk<T>(
  path: string,
  input: unknown,
  opts: { type?: "query" | "mutation" } = {},
): Promise<T> {
  const result = await trpc<T>(path, input, opts);
  if (result.error || result.status >= 400 || result.data === undefined) {
    throw new Error(
      `${path} failed: HTTP ${result.status} ${JSON.stringify(result.error ?? result.data)}`,
    );
  }
  return result.data;
}

beforeAll(async () => {
  if (!RUN) return;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (isFixtureUpstream(url)) {
      capturedUpstream.push({
        url,
        authorization: headerValue(init?.headers, "authorization"),
        body: typeof init?.body === "string" ? init.body : "",
      });
      return new Response(JSON.stringify({ ok: true, id: "re_e2e_http" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input as never, init);
  }) as typeof fetch;

  const app = express();
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("failed to bind HTTP test server");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (!RUN || !workspaceId) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(credentialEgressLog).where(eq(credentialEgressLog.workspaceId, workspaceId));
  await db.delete(actionApprovals).where(eq(actionApprovals.workspaceId, workspaceId));
  await db.delete(actionLedger).where(eq(actionLedger.workspaceId, workspaceId));
  await db.delete(brokeredCredentials).where(eq(brokeredCredentials.workspaceId, workspaceId));
  await db.delete(delegatedAuthorities).where(eq(delegatedAuthorities.workspaceId, workspaceId));
  await db.delete(agentIdentities).where(eq(agentIdentities.workspaceId, workspaceId));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  if (userId) {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
});

d("Agent Firewall — authenticated HTTP broker path", () => {
  const suffix = crypto.randomBytes(4).toString("hex");
  const email = `broker-http-${suffix}@example.com`;
  const password = "BrokerHttpPass123!";
  const name = "Broker HTTP User";

  it("rejects broker without a session even with a matching CSRF pair", async () => {
    const token = "csrf-anonymous-double-submit-token";
    const result = await trpc(
      "agentFirewall.credentials.broker",
      {
        workspaceId: 1,
        credentialId: "cred_missing",
        ledgerId: "act_missing",
        method: "POST",
        targetUrl: `${UPSTREAM_ORIGIN}${UPSTREAM_PATH}`,
      },
      { cookies: `csrf-token=${token}`, csrf: token },
    );
    expect(result.error?.data?.code).toBe("UNAUTHORIZED");
    expect([401, 403]).toContain(result.status);
    expect(capturedUpstream).toHaveLength(0);
  });

  it("signs up over HTTP and establishes a session + CSRF cookie", async () => {
    const result = await trpcOk<{ success: boolean; userId: number }>("auth.signup", {
      email,
      password,
      name,
    });
    expect(result.success).toBe(true);
    expect(result.userId).toBeGreaterThan(0);
    userId = result.userId;
    expect(cookieValue(cookieJar, "access_token")).toBeTruthy();
    expect(cookieValue(cookieJar, "csrf-token")).toBeTruthy();
    csrfToken = cookieValue(cookieJar, "csrf-token") ?? "";
  }, 60_000);

  it("can drop the session and sign back in over HTTP", async () => {
    const savedCsrf = csrfToken;
    cookieJar = `csrf-token=${savedCsrf}`;
    const result = await trpcOk<{ success: boolean; userId?: number; requires2FA?: boolean }>(
      "auth.login",
      { email, password },
    );
    expect(result.success).toBe(true);
    expect(result.requires2FA).toBeFalsy();
    expect(cookieValue(cookieJar, "access_token")).toBeTruthy();
    csrfToken = cookieValue(cookieJar, "csrf-token") ?? csrfToken;
  }, 60_000);

  it("uses the personal workspace created at signup", async () => {
    const listed = await trpcOk<Array<{ id: number; isPersonal: boolean }>>(
      "workspaces.listMine",
      undefined,
      { type: "query" },
    );
    expect(listed.length).toBeGreaterThan(0);
    const personal = listed.find((w) => w.isPersonal) ?? listed[0];
    workspaceId = personal!.id;
    expect(workspaceId).toBeGreaterThan(0);
  });

  it("stores a credential, evaluates ALLOW, brokers once, and writes an egress row", async () => {
    const agent = await trpcOk<{ id: string }>("agentFirewall.identities.create", {
      workspaceId,
      agentKey: `http-broker-${suffix}`,
      name: "HTTP Broker Agent",
      environment: "production",
      mode: "enforce",
      capabilities: ["financial.refund"],
    });
    expect(agent.id).toBeTruthy();

    const authority = await trpcOk<{ capabilityToken: string }>(
      "agentFirewall.authorities.create",
      {
        workspaceId,
        agentId: agent.id,
        scope: {
          actions: ["financial.refund"],
          resources: ["customer:*"],
          environments: ["production"],
          maxAmountMinor: 500_000,
          currency: "INR",
        },
      },
    );
    expect(authority.capabilityToken.startsWith("rk_cap_")).toBe(true);

    const created = await trpcOk<{ credentialId: string; allowedOrigin: string }>(
      "agentFirewall.credentials.create",
      {
        workspaceId,
        name: "HTTP e2e upstream",
        provider: "e2e",
        secret: SECRET,
        allowedActions: ["financial.refund"],
        allowedOrigin: UPSTREAM_ORIGIN,
        injection: "bearer",
      },
    );
    expect(created.credentialId).toBeTruthy();
    expect(created.allowedOrigin).toBe(UPSTREAM_ORIGIN);
    expect(JSON.stringify(created)).not.toContain(SECRET);

    const listed = await trpcOk<{ credentials: Array<{ id: string }> }>(
      "agentFirewall.credentials.list",
      { workspaceId },
      { type: "query" },
    );
    expect(JSON.stringify(listed)).not.toContain(SECRET);
    expect(JSON.stringify(listed)).not.toContain("secretCiphertext");

    const decision = await trpcOk<{
      ledgerId: string;
      decision: string;
      effectiveDecision: string;
    }>("agentFirewall.evaluate", {
      workspaceId,
      agentId: agent.id,
      capabilityToken: authority.capabilityToken,
      idempotencyKey: crypto.randomBytes(16).toString("hex"),
      provider: "e2e",
      operation: "refund.create",
      resource: "customer:1827",
      environment: "production",
      amountMinor: 1_000,
      currency: "INR",
    });
    expect(decision.decision).toBe("ALLOW");
    expect(decision.effectiveDecision).toBe("ALLOW");
    expect(decision.ledgerId).toBeTruthy();

    capturedUpstream.length = 0;
    const brokered = await trpcOk<{
      status: number;
      body: unknown;
      egressId: string;
    }>("agentFirewall.credentials.broker", {
      workspaceId,
      credentialId: created.credentialId,
      ledgerId: decision.ledgerId,
      method: "POST",
      targetUrl: `${UPSTREAM_ORIGIN}${UPSTREAM_PATH}`,
      body: { amount: 1000 },
    });
    expect(brokered.status).toBe(200);
    expect(brokered.egressId).toMatch(/^egr_/);
    expect(JSON.stringify(brokered)).not.toContain(SECRET);
    expect(capturedUpstream).toHaveLength(1);
    expect(capturedUpstream[0]?.url).toBe(`${UPSTREAM_ORIGIN}${UPSTREAM_PATH}`);
    expect(capturedUpstream[0]?.authorization).toBe(`Bearer ${SECRET}`);

    const log = await trpcOk<{
      egress: Array<{
        id: string;
        ledgerId: string;
        responseStatus: number | null;
        targetUrl: string;
      }>;
    }>("agentFirewall.credentials.egressLog", { workspaceId, limit: 20 }, { type: "query" });
    const row = log.egress.find((r) => r.id === brokered.egressId);
    expect(row).toBeTruthy();
    expect(row?.ledgerId).toBe(decision.ledgerId);
    expect(row?.responseStatus).toBe(200);
    expect(row?.targetUrl).toBe(`${UPSTREAM_ORIGIN}${UPSTREAM_PATH}`);
    expect(JSON.stringify(log)).not.toContain(SECRET);

    const replay = await trpc("agentFirewall.credentials.broker", {
      workspaceId,
      credentialId: created.credentialId,
      ledgerId: decision.ledgerId,
      method: "POST",
      targetUrl: `${UPSTREAM_ORIGIN}${UPSTREAM_PATH}`,
      body: { amount: 1000 },
    });
    expect(replay.status).toBe(409);
    expect(replay.error?.data?.code).toBe("CONFLICT");
    expect(capturedUpstream).toHaveLength(1);
  }, 60_000);
});
