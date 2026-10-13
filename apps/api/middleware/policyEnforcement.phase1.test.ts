import { beforeEach, describe, expect, it, vi } from "vitest";
import { enforcePolicies } from "./policyEnforcement";
import { evaluatePolicy } from "../engines/policyEngine";
import { getWorkspaceRules } from "../services/policyCache";
import type { AIEventContext } from "../engines/policyEngine";

vi.mock("../services/policyCache", () => ({ getWorkspaceRules: vi.fn() }));
vi.mock("../engines/policyEngine", () => ({ evaluatePolicy: vi.fn() }));
vi.mock("../_core/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../db", () => ({ getDb: vi.fn() }));

const event: AIEventContext = {
  model: "test-model",
  provider: "example",
  costUsd: 0,
  inputTokens: 0,
  prompt: "hello",
  threatLevel: "none",
  agentId: "agent-test",
  timestamp: new Date("2026-10-08T00:00:00.000Z"),
};

describe("Phase 1 policy redaction fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspaceRules).mockResolvedValue([
      {
        ruleId: "test-redact",
        name: "Redact secrets",
        priority: 1,
        enabled: true,
        conditions: { operator: "AND", rules: [] },
        action: "redact",
      },
    ]);
  });
  it("rejects a redaction decision rather than silently allowing an unredacted request", async () => {
    vi.mocked(evaluatePolicy).mockReturnValue({
      action: "redact",
      matchedRuleId: "test-redact",
      matchedRuleName: "Redact secrets",
      reason: "sensitive content",
    });
    await expect(enforcePolicies(event, "ws_123")).rejects.toThrow(/redaction/i);
  });
  it("preserves an explicit allow decision", async () => {
    vi.mocked(evaluatePolicy).mockReturnValue({
      action: "allow",
      matchedRuleId: "allow-rule",
      matchedRuleName: "Allow",
      reason: "test",
    });
    await expect(enforcePolicies(event, "ws_123")).resolves.toMatchObject({ action: "allow" });
  });
  it("blocks explicit deny decisions", async () => {
    vi.mocked(evaluatePolicy).mockReturnValue({
      action: "block",
      matchedRuleId: "block-rule",
      matchedRuleName: "Block",
      reason: "test",
    });
    await expect(enforcePolicies(event, "ws_123")).rejects.toThrow(/blocked by policy/i);
  });
});
