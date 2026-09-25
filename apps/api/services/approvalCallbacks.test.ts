import { describe, expect, it } from "vitest";

import {
  buildApprovalCallbackUrl,
  signApprovalCallback,
  signReceipt,
  verifyApprovalCallback,
} from "./approvalCallbacks";

const SECRET = "test-server-secret-that-is-long-enough";

function queryOf(url: string): Record<string, string | undefined> {
  const q = new URL(url).searchParams;
  return {
    approvalId: q.get("approvalId") ?? undefined,
    decision: q.get("decision") ?? undefined,
    exp: q.get("exp") ?? undefined,
    sig: q.get("sig") ?? undefined,
  };
}

describe("approval callback signing round-trip", () => {
  it("signs then verifies approve", () => {
    const url = buildApprovalCallbackUrl("https://api.example.com", "apr_123", "approve", 60_000, SECRET);
    expect(url).not.toBeNull();
    const v = verifyApprovalCallback(queryOf(url!), Date.now(), SECRET);
    expect(v).toEqual({ ok: true, approvalId: "apr_123", decision: "approve" });
  });

  it("signs then verifies reject", () => {
    const url = buildApprovalCallbackUrl("https://api.example.com/", "apr_9", "reject", 60_000, SECRET);
    const v = verifyApprovalCallback(queryOf(url!), Date.now(), SECRET);
    expect(v).toEqual({ ok: true, approvalId: "apr_9", decision: "reject" });
  });

  it("rejects a tampered signature", () => {
    const url = buildApprovalCallbackUrl("https://api.example.com", "apr_123", "approve", 60_000, SECRET)!;
    const q = queryOf(url);
    q.sig = q.sig!.slice(0, -1) + (q.sig!.endsWith("0") ? "1" : "0");
    expect(verifyApprovalCallback(q, Date.now(), SECRET)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a tampered approvalId", () => {
    const url = buildApprovalCallbackUrl("https://api.example.com", "apr_123", "approve", 60_000, SECRET)!;
    const q = queryOf(url);
    q.approvalId = "apr_999";
    expect(verifyApprovalCallback(q, Date.now(), SECRET)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects an expired link", () => {
    const exp = Date.now() - 1_000;
    const sig = signApprovalCallback("apr_1", "approve", exp, SECRET)!;
    const v = verifyApprovalCallback(
      { approvalId: "apr_1", decision: "approve", exp: String(exp), sig },
      Date.now(),
      SECRET,
    );
    expect(v).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a wrong-secret signature", () => {
    const url = buildApprovalCallbackUrl("https://api.example.com", "apr_1", "approve", 60_000, SECRET)!;
    expect(verifyApprovalCallback(queryOf(url), Date.now(), "other-secret")).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects malformed params", () => {
    expect(verifyApprovalCallback({}, Date.now(), SECRET)).toEqual({
      ok: false,
      reason: "bad_params",
    });
    expect(
      verifyApprovalCallback(
        { approvalId: "a", decision: "maybe", exp: "123", sig: "x" },
        Date.now(),
        SECRET,
      ),
    ).toEqual({ ok: false, reason: "bad_params" });
  });

  it("fails closed when no secret is configured", () => {
    expect(buildApprovalCallbackUrl("https://api.example.com", "apr_1", "approve", 60_000, "")).toBeNull();
    expect(signApprovalCallback("apr_1", "approve", Date.now() + 1000, "")).toBeNull();
    expect(
      verifyApprovalCallback(
        { approvalId: "a", decision: "approve", exp: String(Date.now() + 1000), sig: "x" },
        Date.now(),
        "",
      ),
    ).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("signReceipt", () => {
  it("attaches a hex signature", () => {
    const r = signReceipt({ approvalId: "apr_1", decision: "reject" }, SECRET);
    expect(r).not.toBeNull();
    expect(r!.sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns null without a secret", () => {
    expect(signReceipt({ a: 1 }, "")).toBeNull();
  });
});
