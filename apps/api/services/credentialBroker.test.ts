/**
 * Credential-broker security tests.
 *
 * These cover the checks that stand between an agent and a real provider
 * secret. Each `it` below corresponds to a way the broker could be tricked
 * into either releasing the credential to the wrong place or executing an
 * action the policy engine did not actually authorize.
 */
import { describe, expect, it, vi } from "vitest";
import {
  authorizeBrokeredRequest,
  buildAuthHeader,
  executeBrokeredCall,
  isPrivateHost,
  originOf,
  redactSecret,
  sanitizeForwardHeaders,
  sanitizeResponseHeaders,
  LEDGER_FRESHNESS_MS,
  type CredentialFacts,
  type LedgerFacts,
} from "./credentialBroker";

const NOW = new Date("2026-08-05T12:00:00.000Z");

const ledger = (over: Partial<LedgerFacts> = {}): LedgerFacts => ({
  id: "act_1",
  workspaceId: 1,
  semanticAction: "financial.refund",
  decision: "ALLOW",
  effectiveDecision: "ALLOW",
  occurredAt: new Date(NOW.getTime() - 1000),
  ...over,
});

const credential = (over: Partial<CredentialFacts> = {}): CredentialFacts => ({
  id: "cred_1",
  workspaceId: 1,
  status: "active",
  allowedActions: ["financial.refund"],
  allowedOrigin: "https://api.stripe.com",
  injection: "bearer",
  headerName: null,
  ...over,
});

const authorize = (over: Partial<Parameters<typeof authorizeBrokeredRequest>[0]> = {}) =>
  authorizeBrokeredRequest({
    ledger: ledger(),
    credential: credential(),
    workspaceId: 1,
    targetUrl: "https://api.stripe.com/v1/refunds",
    now: NOW,
    ...over,
  });

describe("authorizeBrokeredRequest — happy path", () => {
  it("allows a fresh ALLOW against a matching credential and origin", () => {
    expect(authorize()).toEqual({ allowed: true, reasons: [] });
  });

  it("allows a wildcard credential allowlist", () => {
    expect(authorize({ credential: credential({ allowedActions: ["financial.*"] }) }).allowed).toBe(
      true,
    );
  });
});

describe("authorizeBrokeredRequest — decision integrity", () => {
  it("refuses when the true decision was not ALLOW", () => {
    const r = authorize({ ledger: ledger({ decision: "DENY" }) });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("decision_not_allow");
  });

  it("refuses shadow-mode laundering: DENY recorded, effective ALLOW", () => {
    // This is the critical one. In shadow mode evaluate() returns
    // effectiveDecision ALLOW even for a denied action; brokering on that
    // alone would execute every denied action for anyone in shadow mode.
    const r = authorize({
      ledger: ledger({ decision: "DENY", effectiveDecision: "ALLOW" }),
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("decision_not_allow");
  });

  it("refuses an approval that is still pending", () => {
    const r = authorize({
      ledger: ledger({ decision: "APPROVAL_REQUIRED", effectiveDecision: "PENDING_APPROVAL" }),
    });
    expect(r.allowed).toBe(false);
  });

  it("refuses a LIMIT or PAUSE decision", () => {
    for (const decision of ["LIMIT", "PAUSE", "FREEZE"]) {
      expect(authorize({ ledger: ledger({ decision, effectiveDecision: "DENY" }) }).allowed).toBe(
        false,
      );
    }
  });

  it("refuses when no ledger record was supplied", () => {
    const r = authorize({ ledger: null });
    expect(r.reasons).toContain("ledger_record_not_found");
  });
});

describe("authorizeBrokeredRequest — freshness", () => {
  it("refuses a stale ALLOW", () => {
    const r = authorize({
      ledger: ledger({ occurredAt: new Date(NOW.getTime() - LEDGER_FRESHNESS_MS - 1000) }),
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("ledger_record_stale");
  });

  it("allows one just inside the freshness window", () => {
    const r = authorize({
      ledger: ledger({ occurredAt: new Date(NOW.getTime() - LEDGER_FRESHNESS_MS + 1000) }),
    });
    expect(r.allowed).toBe(true);
  });

  it("refuses a record dated in the future", () => {
    const r = authorize({
      ledger: ledger({ occurredAt: new Date(NOW.getTime() + 5 * 60 * 1000) }),
    });
    expect(r.reasons).toContain("ledger_timestamp_in_future");
  });

  it("refuses an unparseable timestamp", () => {
    expect(authorize({ ledger: ledger({ occurredAt: null }) }).reasons).toContain(
      "ledger_timestamp_invalid",
    );
  });
});

describe("authorizeBrokeredRequest — tenant isolation", () => {
  it("refuses a ledger record from another workspace", () => {
    const r = authorize({ ledger: ledger({ workspaceId: 2 }) });
    expect(r.reasons).toContain("ledger_wrong_workspace");
  });

  it("refuses a credential from another workspace", () => {
    const r = authorize({ credential: credential({ workspaceId: 2 }) });
    expect(r.reasons).toContain("credential_wrong_workspace");
  });
});

describe("authorizeBrokeredRequest — credential scope", () => {
  it("refuses a credential minted for a different action", () => {
    const r = authorize({ credential: credential({ allowedActions: ["financial.payout"] }) });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("action_not_permitted_for_credential");
  });

  it("refuses a revoked credential", () => {
    expect(authorize({ credential: credential({ status: "revoked" }) }).reasons).toContain(
      "credential_revoked",
    );
  });

  it("refuses a missing credential", () => {
    expect(authorize({ credential: null }).reasons).toContain("credential_not_found");
  });

  it("refuses header injection with no header name configured", () => {
    const r = authorize({
      credential: credential({ injection: "header", headerName: null }),
    });
    expect(r.reasons).toContain("credential_header_name_missing");
  });

  it("does not let a prefix wildcard cross a domain boundary", () => {
    const r = authorize({
      ledger: ledger({ semanticAction: "code.merge" }),
      credential: credential({ allowedActions: ["financial.*"] }),
    });
    expect(r.allowed).toBe(false);
  });
});

describe("authorizeBrokeredRequest — egress destination", () => {
  it("refuses a different origin than the credential's", () => {
    const r = authorize({ targetUrl: "https://evil.example.com/v1/refunds" });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("target_origin_not_allowed");
  });

  it("refuses plain http", () => {
    const r = authorize({ targetUrl: "http://api.stripe.com/v1/refunds" });
    expect(r.reasons).toContain("target_url_invalid_or_not_https");
  });

  it("refuses a malformed url", () => {
    expect(authorize({ targetUrl: "not a url" }).allowed).toBe(false);
  });

  it("refuses a lookalike subdomain", () => {
    const r = authorize({ targetUrl: "https://api.stripe.com.evil.example/v1/refunds" });
    expect(r.reasons).toContain("target_origin_not_allowed");
  });

  it("refuses a userinfo-smuggled host", () => {
    const r = authorize({ targetUrl: "https://api.stripe.com@evil.example/v1" });
    expect(r.allowed).toBe(false);
  });

  it("refuses a port mismatch on the same host", () => {
    const r = authorize({ targetUrl: "https://api.stripe.com:8443/v1/refunds" });
    expect(r.reasons).toContain("target_origin_not_allowed");
  });

  it("refuses internal targets even when the credential allows them", () => {
    const r = authorize({
      credential: credential({ allowedOrigin: "https://169.254.169.254" }),
      targetUrl: "https://169.254.169.254/latest/meta-data/",
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("target_host_private");
  });
});

describe("isPrivateHost", () => {
  it.each([
    "localhost",
    "app.localhost",
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "::1",
    "fd00::1",
    "0.0.0.0",
  ])("treats %s as private", (h) => expect(isPrivateHost(h)).toBe(true));

  it.each(["api.stripe.com", "8.8.8.8", "172.32.0.1", "11.0.0.1"])(
    "treats %s as public",
    (h) => expect(isPrivateHost(h)).toBe(false),
  );
});

describe("originOf", () => {
  it("normalizes case and drops the path", () => {
    expect(originOf("https://API.Stripe.com/v1/refunds?x=1")).toBe("https://api.stripe.com");
  });
  it("rejects non-https", () => {
    expect(originOf("http://api.stripe.com")).toBeNull();
    expect(originOf("file:///etc/passwd")).toBeNull();
  });
  it("keeps a non-default port distinct", () => {
    expect(originOf("https://api.stripe.com:8443/v1")).toBe("https://api.stripe.com:8443");
  });
});

describe("buildAuthHeader", () => {
  it("builds a bearer header", () => {
    expect(buildAuthHeader("bearer", null, "fixture-basic-auth-secret")).toEqual({
      name: "authorization",
      value: "Bearer fixture-basic-auth-secret",
    });
  });

  it("builds a basic header with an empty password", () => {
    const { value } = buildAuthHeader("basic", null, "fixture-basic-auth-secret");
    expect(Buffer.from(value.replace("Basic ", ""), "base64").toString()).toBe("fixture-basic-auth-secret:");
  });

  it("builds a custom header, lowercased", () => {
    expect(buildAuthHeader("header", "X-Api-Key", "abc")).toEqual({
      name: "x-api-key",
      value: "abc",
    });
  });

  it("throws when a custom header has no name", () => {
    expect(() => buildAuthHeader("header", null, "abc")).toThrow();
  });
});

describe("sanitizeForwardHeaders", () => {
  it("drops caller-supplied credential and spoofable headers", () => {
    const { headers, dropped } = sanitizeForwardHeaders({
      Authorization: "Bearer attacker",
      Cookie: "session=1",
      "X-Forwarded-For": "1.2.3.4",
      "Idempotency-Key": "abc",
    });
    expect(headers).toEqual({ "idempotency-key": "abc" });
    expect(dropped).toEqual(
      expect.arrayContaining(["authorization", "cookie", "x-forwarded-for"]),
    );
  });

  it("handles no headers", () => {
    expect(sanitizeForwardHeaders(undefined).headers).toEqual({});
  });
});

describe("sanitizeResponseHeaders", () => {
  it("strips set-cookie and auth headers from the provider response", () => {
    const h = new Headers({
      "content-type": "application/json",
      "set-cookie": "a=b",
      authorization: "Bearer x",
    });
    const out = sanitizeResponseHeaders(h);
    expect(out["content-type"]).toBe("application/json");
    expect(out["set-cookie"]).toBeUndefined();
    expect(out["authorization"]).toBeUndefined();
  });
});

describe("redactSecret", () => {
  it("redacts a credential echoed back by the provider", () => {
    const out = redactSecret({ error: { message: "Invalid key fixture-echoed-secret-value" } }, "fixture-echoed-secret-value");
    expect(JSON.stringify(out)).not.toContain("fixture-echoed-secret-value");
    expect(JSON.stringify(out)).toContain("[REDACTED]");
  });

  it("leaves an unrelated body untouched", () => {
    const body = { ok: true };
    expect(redactSecret(body, "fixture-echoed-secret-value")).toBe(body);
  });

  it("ignores implausibly short secrets", () => {
    const body = { a: "xy" };
    expect(redactSecret(body, "xy")).toBe(body);
  });
});

describe("executeBrokeredCall", () => {
  const okResponse = (body: unknown = { id: "re_1" }) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("injects the secret and never forwards a caller-supplied authorization", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await executeBrokeredCall({
      targetUrl: "https://api.stripe.com/v1/refunds",
      method: "post",
      secret: "fixture-secret-1",
      injection: "bearer",
      headerName: null,
      headers: { Authorization: "Bearer attacker", "Idempotency-Key": "k1" },
      body: { amount: 100 },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/refunds");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer fixture-secret-1");
    expect(init.headers["idempotency-key"]).toBe("k1");
    expect(init.body).toBe(JSON.stringify({ amount: 100 }));
  });

  it("never follows redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await executeBrokeredCall({
      targetUrl: "https://api.stripe.com/v1/refunds",
      method: "get",
      secret: "fixture-secret-1",
      injection: "bearer",
      headerName: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0][1].redirect).toBe("manual");
  });

  it("omits a body on GET", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    await executeBrokeredCall({
      targetUrl: "https://api.stripe.com/v1/refunds",
      method: "GET",
      secret: "fixture-secret-1",
      injection: "bearer",
      headerName: null,
      body: { nope: true },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls[0][1].body).toBeUndefined();
  });

  it("returns parsed json, status and sanitized headers", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "re_1" }), {
        status: 201,
        headers: { "content-type": "application/json", "set-cookie": "a=b" },
      }),
    );
    const r = await executeBrokeredCall({
      targetUrl: "https://api.stripe.com/v1/refunds",
      method: "post",
      secret: "fixture-secret-1",
      injection: "bearer",
      headerName: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ id: "re_1" });
    expect(r.headers["set-cookie"]).toBeUndefined();
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("falls back to raw text for a non-json response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("plain text", { status: 500 }));
    const r = await executeBrokeredCall({
      targetUrl: "https://api.stripe.com/v1/refunds",
      method: "get",
      secret: "fixture-secret-1",
      injection: "bearer",
      headerName: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.body).toBe("plain text");
  });
});
