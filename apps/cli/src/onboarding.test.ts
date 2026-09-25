import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "@rakshex/policy-engine";
import { buildInitPolicy, INR_PER_USD } from "./init.js";
import {
  createBundle,
  generateReceiptKeypair,
  signEntry,
  verifyBundle,
  GENESIS_HASH,
} from "./receipts.js";

const refundCtx = (amountInr: number) => ({
  toolName: "financial.refund",
  toolCalls: [{ name: "financial.refund" }],
  costUsdSoFar: Math.round((amountInr / INR_PER_USD) * 100) / 100,
  agentId: "demo-agent",
  prompt: "refund customer order #4821",
});

describe("rakshex init policy", () => {
  it("denies a ₹10,000 refund over a ₹500 limit", () => {
    const policy = buildInitPolicy({ agentName: "t", allowed: [1, 2, 3, 4], spendingLimitInr: 500 });
    const d = evaluatePolicy(policy as Parameters<typeof evaluatePolicy>[0], refundCtx(10_000));
    expect(d.action).toBe("deny");
    expect(d.matchedRules).toContain("spending-limit");
  });

  it("requires approval for a ₹100 refund under the limit", () => {
    const policy = buildInitPolicy({ agentName: "t", allowed: [1, 2, 3, 4], spendingLimitInr: 500 });
    const d = evaluatePolicy(policy as Parameters<typeof evaluatePolicy>[0], refundCtx(100));
    expect(d.action).toBe("require_approval");
  });

  it("denies actions that were not granted", () => {
    const policy = buildInitPolicy({ agentName: "t", allowed: [1], spendingLimitInr: 500 });
    const d = evaluatePolicy(policy as Parameters<typeof evaluatePolicy>[0], refundCtx(100));
    expect(d.action).toBe("deny");
  });

  it("allows granted read-data without approval", () => {
    const policy = buildInitPolicy({ agentName: "t", allowed: [1], spendingLimitInr: 500 });
    const d = evaluatePolicy(policy as Parameters<typeof evaluatePolicy>[0], {
      toolName: "data.read",
      toolCalls: [{ name: "data.read" }],
      costUsdSoFar: 0,
    });
    expect(d.action).toBe("allow");
  });
});

describe("local receipts", () => {
  it("sign → bundle → verify round-trips offline", () => {
    const kp = generateReceiptKeypair("test-key");
    const e1 = signEntry(
      {
        workspaceId: "ws_test",
        requestId: "req-1",
        eventType: "policy.decision",
        payload: { demoMode: true, decision: "deny" },
        previousHash: GENESIS_HASH,
      },
      kp,
    );
    const e2 = signEntry(
      {
        workspaceId: "ws_test",
        requestId: "req-2",
        eventType: "approval.granted",
        payload: { demoMode: true },
        previousHash: e1.entryHash,
      },
      kp,
    );
    const bundle = createBundle("ws_test", [e1, e2], kp);
    expect(verifyBundle(bundle)).toEqual({ valid: true });
  });

  it("detects a tampered payload", () => {
    const kp = generateReceiptKeypair("test-key");
    const e1 = signEntry(
      {
        workspaceId: "ws_test",
        requestId: "req-1",
        eventType: "policy.decision",
        payload: { demoMode: true, decision: "deny" },
        previousHash: GENESIS_HASH,
      },
      kp,
    );
    const tampered = { ...e1, payload: { demoMode: true, decision: "allow" } };
    const bundle = createBundle("ws_test", [tampered], kp);
    const result = verifyBundle(bundle);
    expect(result.valid).toBe(false);
  });

  it("detects a broken hash chain", () => {
    const kp = generateReceiptKeypair("test-key");
    const e1 = signEntry(
      {
        workspaceId: "ws_test",
        requestId: "req-1",
        eventType: "policy.decision",
        payload: {},
        previousHash: "f".repeat(64),
      },
      kp,
    );
    const bundle = createBundle("ws_test", [e1], kp);
    expect(verifyBundle(bundle).valid).toBe(false);
  });
});
