import { describe, expect, it } from "vitest";
import { evaluateAction, normalizeSemanticAction, validateAttenuation } from "./index";

describe("semantic action normalization", () => {
  it("normalizes payment, GitHub, Postgres and MCP operations", () => {
    expect(normalizeSemanticAction({ provider: "stripe", operation: "refunds.create" }).name).toBe(
      "financial.refund",
    );
    expect(normalizeSemanticAction({ provider: "github", operation: "pulls.merge" }).name).toBe(
      "code.merge",
    );
    expect(
      normalizeSemanticAction({
        provider: "postgres",
        operation: "query",
        parameters: { sql: "DELETE FROM users" },
      }).name,
    ).toBe("database.delete");
    expect(
      normalizeSemanticAction({
        provider: "mcp",
        operation: "tools/call",
        toolName: "createPullRequest",
      }).name,
    ).toBe("code.pr.create");
  });

  it("redacts secrets and never invents an unknown mapping", () => {
    const action = normalizeSemanticAction({
      provider: "custom",
      operation: "doSomething",
      parameters: { apiKey: "secret", nested: { password: "hidden", safe: "ok" } },
    });
    expect(action.name).toBe("semantic.unknown");
    expect(action.parameters).toEqual({
      apiKey: "[REDACTED]",
      nested: { password: "[REDACTED]", safe: "ok" },
    });
  });
});

describe("delegated authority", () => {
  const parent = {
    actions: ["financial.*", "database.read"],
    resources: ["customer:*"],
    environments: ["production", "staging"],
    maxAmountMinor: 500_000,
    currency: "INR",
    maxCount: 10,
    expiresAt: "2026-08-31T00:00:00.000Z",
    maxDelegationDepth: 2,
  };

  it("accepts a narrower child and rejects privilege expansion", () => {
    expect(
      validateAttenuation(parent, {
        actions: ["financial.refund"],
        resources: ["customer:1827"],
        environments: ["production"],
        maxAmountMinor: 100_000,
        currency: "INR",
        maxCount: 1,
        expiresAt: "2026-08-02T00:00:00.000Z",
        maxDelegationDepth: 1,
      }).valid,
    ).toBe(true);
    expect(validateAttenuation(parent, { ...parent, actions: ["code.merge"] }).valid).toBe(false);
  });
});

describe("decision engine", () => {
  const refund = normalizeSemanticAction({
    provider: "razorpay",
    operation: "refund.create",
    resource: "customer:1827",
    environment: "production",
    amountMinor: 800_000,
    currency: "INR",
  });
  const authority = {
    actions: ["financial.refund"],
    resources: ["customer:*"],
    environments: ["production"],
    maxAmountMinor: 500_000,
    currency: "INR",
  };

  it("reports a denial without blocking in shadow mode", () => {
    const result = evaluateAction({ mode: "shadow", action: refund, authority });
    expect(result.decision).toBe("DENY");
    expect(result.effectiveDecision).toBe("ALLOW");
    expect(result.wouldBlock).toBe(true);
    expect(result.enforced).toBe(false);
  });

  it("blocks the same action in enforce mode", () => {
    const result = evaluateAction({ mode: "enforce", action: refund, authority });
    expect(result.decision).toBe("DENY");
    expect(result.effectiveDecision).toBe("DENY");
    expect(result.enforced).toBe(true);
  });
});
