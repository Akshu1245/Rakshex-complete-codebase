/**
 * Tests for policy engine — evaluate function.
 */
import { describe, it, expect } from "vitest";
import { evaluate, type AIEventContext, type PolicyRule, type ConditionGroup } from "../engines/policyEngine";

function makeEvent(overrides: Partial<AIEventContext> = {}): AIEventContext {
  return {
    model: "gpt-4o",
    provider: "openai",
    cost_usd: 0.05,
    input_tokens: 500,
    prompt: "Hello, can you help me?",
    threat_level: "none",
    agent_id: "agent-1",
    user_id: "user-1",
    tool_calls: [],
    timestamp: new Date("2025-01-01T12:00:00Z"),
    ...overrides,
  };
}

function makeRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    rule_id: "rule-1",
    workspace_id: "ws-1",
    name: "Test Rule",
    enabled: true,
    priority: 0,
    conditions: {
      operator: "AND",
      rules: [{ field: "model", op: "eq", value: "gpt-4o" }],
    },
    action: "block",
    ...overrides,
  };
}

describe("policyEngine.evaluate", () => {
  it("matches model eq condition", () => {
    const d = evaluate(makeEvent(), [makeRule()]);
    expect(d.action).toBe("block");
    expect(d.matchedRuleId).toBe("rule-1");
  });

  it("returns allow when no match", () => {
    const d = evaluate(
      makeEvent({ model: "claude-3" }),
      [makeRule()],
    );
    expect(d.action).toBe("allow");
  });

  it("matches provider in condition", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "provider", op: "eq", value: "openai" }],
      },
    });
    const d = evaluate(makeEvent(), [rule]);
    expect(d.action).toBe("block");
  });

  it("matches cost_usd gt condition", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "cost_usd", op: "gt", value: 0.01 }],
      },
    });
    const d = evaluate(makeEvent({ cost_usd: 0.05 }), [rule]);
    expect(d.action).toBe("block");
  });

  it("does not match cost_usd gt when under threshold", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "cost_usd", op: "gt", value: 0.10 }],
      },
    });
    const d = evaluate(makeEvent({ cost_usd: 0.05 }), [rule]);
    expect(d.action).toBe("allow");
  });

  it("matches prompt_contains keyword", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "prompt_contains", op: "keyword", value: "help me" }],
      },
    });
    const d = evaluate(makeEvent({ prompt: "Hello, can you help me?" }), [rule]);
    expect(d.action).toBe("block");
  });

  it("matches prompt_contains regex", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "prompt_contains", op: "regex", value: "help\\s+me" }],
      },
    });
    const d = evaluate(makeEvent({ prompt: "Can you help me please" }), [rule]);
    expect(d.action).toBe("block");
  });

  it("matches threat_level gte", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "threat_level", op: "gte", value: "high" }],
      },
    });
    const d = evaluate(makeEvent({ threat_level: "critical" }), [rule]);
    expect(d.action).toBe("block");
  });

  it("does not match threat_level gte when lower", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "threat_level", op: "gte", value: "high" }],
      },
    });
    const d = evaluate(makeEvent({ threat_level: "medium" }), [rule]);
    expect(d.action).toBe("allow");
  });

  it("supports AND operator — all conditions must match", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [
          { field: "model", op: "eq", value: "gpt-4o" },
          { field: "provider", op: "eq", value: "openai" },
        ],
      },
    });
    const d = evaluate(makeEvent(), [rule]);
    expect(d.action).toBe("block");
  });

  it("AND fails if one condition fails", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [
          { field: "model", op: "eq", value: "gpt-4o" },
          { field: "provider", op: "eq", value: "anthropic" },
        ],
      },
    });
    const d = evaluate(makeEvent(), [rule]);
    expect(d.action).toBe("allow");
  });

  it("supports OR operator — at least one match", () => {
    const rule = makeRule({
      conditions: {
        operator: "OR",
        rules: [
          { field: "model", op: "eq", value: "claude-3" },
          { field: "provider", op: "eq", value: "openai" },
        ],
      },
    });
    const d = evaluate(makeEvent(), [rule]);
    expect(d.action).toBe("block");
  });

  it("first match wins by priority", () => {
    const rule1 = makeRule({
      rule_id: "low-priority",
      priority: 10,
      action: "redact",
      conditions: {
        operator: "AND",
        rules: [{ field: "model", op: "eq", value: "gpt-4o" }],
      },
    });
    const rule2 = makeRule({
      rule_id: "high-priority",
      priority: 0,
      action: "block",
      conditions: {
        operator: "AND",
        rules: [{ field: "model", op: "eq", value: "gpt-4o" }],
      },
    });

    const d = evaluate(makeEvent(), [rule1, rule2]);
    expect(d.action).toBe("block");
    expect(d.matchedRuleId).toBe("high-priority");
  });

  it("agent_id in condition matches", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "agent_id", op: "in", value: ["agent-1", "agent-2"] }],
      },
    });
    const d = evaluate(makeEvent(), [rule]);
    expect(d.action).toBe("block");
  });

  it("agent_id not_in condition blocks unknown agents", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "agent_id", op: "not_in", value: ["agent-1"] }],
      },
    });
    const d = evaluate(makeEvent({ agent_id: "rogue-agent" }), [rule]);
    expect(d.action).toBe("block");
  });

  it("tool_name match", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "tool_name", op: "eq", value: "run_shell" }],
      },
    });
    const d = evaluate(
      makeEvent({ tool_calls: [{ name: "run_shell" }, { name: "query_db" }] }),
      [rule],
    );
    expect(d.action).toBe("block");
  });

  it("hour_of_day between matches", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "hour_of_day", op: "between", value: [8, 18] }],
      },
    });
    const d = evaluate(
      makeEvent({ timestamp: new Date("2025-01-01T12:00:00Z") }),
      [rule],
    );
    expect(d.action).toBe("block");
  });

  it("hour_of_day between does not match outside range", () => {
    const rule = makeRule({
      conditions: {
        operator: "AND",
        rules: [{ field: "hour_of_day", op: "between", value: [8, 18] }],
      },
    });
    const d = evaluate(
      makeEvent({ timestamp: new Date("2025-01-01T05:00:00Z") }),
      [rule],
    );
    expect(d.action).toBe("allow");
  });

  it("disabled rules are skipped", () => {
    const rule = makeRule({ enabled: false, action: "block" });
    const d = evaluate(makeEvent(), [rule]);
    expect(d.action).toBe("allow");
  });

  it("performance: 1000 rules under 100ms", () => {
    const rules: PolicyRule[] = Array.from({ length: 1000 }, (_, i) =>
      makeRule({
        rule_id: `rule-${i}`,
        priority: i,
        conditions: {
          operator: "AND",
          rules: [
            { field: "model", op: "eq", value: `model-${i}` },
            { field: "provider", op: "eq", value: "openai" },
          ],
        },
      }),
    );
    // Add one early-match rule
    rules.unshift(
      makeRule({
        rule_id: "match-first",
        priority: -1,
        conditions: {
          operator: "AND",
          rules: [{ field: "model", op: "eq", value: "gpt-4o" }],
        },
      }),
    );

    const start = performance.now();
    const d = evaluate(makeEvent(), rules);
    const duration = performance.now() - start;

    expect(d.action).toBe("block");
    expect(d.matchedRuleId).toBe("match-first");
    expect(duration).toBeLessThan(50);
  });

  it("returns allow with no rules", () => {
    const d = evaluate(makeEvent(), []);
    expect(d.action).toBe("allow");
    expect(d.matchedRuleId).toBeNull();
  });
});
