// @ts-nocheck  
import { describe, expect, it } from "vitest";

import {
  type AlertRule,
  type MetricSnapshot,
  dryRunRule,
  evaluateRule,
  validateRule,
} from "./alertRules";

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 1,
    userId: 42,
    name: "Test rule",
    enabled: true,
    conditions: [{ metric: "cost_usd", operator: "gt", threshold: 10 }],
    window: "24h",
    cooldownMinutes: 30,
    severity: "high",
    channels: { discordWebhookUrl: "https://discord.com/api/webhooks/123/abc" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastFiredAt: null,
    ...overrides,
  };
}

function snap(metric: MetricSnapshot["metric"], value: number): MetricSnapshot {
  return { metric, value, observedAt: new Date("2026-05-08T10:00:00Z") };
}

describe("evaluateRule", () => {
  const NOW = new Date("2026-05-08T10:00:00Z");

  it("fires when single condition matches", () => {
    const rule = makeRule();
    const verdict = evaluateRule(rule, [snap("cost_usd", 50)], NOW);
    expect(verdict.fired).toBe(true);
    if (verdict.fired) {
      expect(verdict.matched).toHaveLength(1);
      expect(verdict.summary).toContain("[HIGH]");
      expect(verdict.summary).toContain("cost_usd=$50.00");
    }
  });

  it("does not fire when condition does not match", () => {
    const rule = makeRule();
    const verdict = evaluateRule(rule, [snap("cost_usd", 5)], NOW);
    expect(verdict.fired).toBe(false);
    if (!verdict.fired) expect(verdict.reason).toBe("no_match");
  });

  it("requires ALL conditions to match (logical AND)", () => {
    const rule = makeRule({
      conditions: [
        { metric: "cost_usd", operator: "gt", threshold: 10 },
        { metric: "blocked_requests", operator: "gte", threshold: 5 },
      ],
    });
    const onlyOne = evaluateRule(
      rule,
      [snap("cost_usd", 20), snap("blocked_requests", 0)],
      NOW
    );
    expect(onlyOne.fired).toBe(false);
    const both = evaluateRule(
      rule,
      [snap("cost_usd", 20), snap("blocked_requests", 7)],
      NOW
    );
    expect(both.fired).toBe(true);
  });

  it("reports 'disabled' when rule.enabled is false", () => {
    const rule = makeRule({ enabled: false });
    const v = evaluateRule(rule, [snap("cost_usd", 100)], NOW);
    expect(v.fired).toBe(false);
    if (!v.fired) expect(v.reason).toBe("disabled");
  });

  it("respects cooldown", () => {
    const rule = makeRule({
      cooldownMinutes: 30,
      lastFiredAt: new Date(NOW.getTime() - 10 * 60_000),
    });
    const v = evaluateRule(rule, [snap("cost_usd", 100)], NOW);
    expect(v.fired).toBe(false);
    if (!v.fired) expect(v.reason).toBe("cooldown");
  });

  it("re-fires after cooldown window elapses", () => {
    const rule = makeRule({
      cooldownMinutes: 30,
      lastFiredAt: new Date(NOW.getTime() - 60 * 60_000),
    });
    const v = evaluateRule(rule, [snap("cost_usd", 100)], NOW);
    expect(v.fired).toBe(true);
  });

  it("treats missing snapshots as no-match (not crash)", () => {
    const rule = makeRule();
    const v = evaluateRule(rule, [], NOW);
    expect(v.fired).toBe(false);
    if (!v.fired) {
      expect(v.reason).toBe("no_match");
      expect(v.missing).toEqual(rule.conditions);
    }
  });

  it("handles all 5 operators correctly", () => {
    const matrix: Array<{ op: AlertRule["conditions"][0]["operator"]; thresh: number; val: number; expected: boolean }> = [
      { op: "gt", thresh: 10, val: 11, expected: true },
      { op: "gt", thresh: 10, val: 10, expected: false },
      { op: "gte", thresh: 10, val: 10, expected: true },
      { op: "lt", thresh: 10, val: 9, expected: true },
      { op: "lt", thresh: 10, val: 10, expected: false },
      { op: "lte", thresh: 10, val: 10, expected: true },
      { op: "eq", thresh: 7, val: 7, expected: true },
      { op: "eq", thresh: 7, val: 8, expected: false },
    ];
    for (const t of matrix) {
      const rule = makeRule({
        conditions: [{ metric: "cost_usd", operator: t.op, threshold: t.thresh }],
      });
      const v = evaluateRule(rule, [snap("cost_usd", t.val)], NOW);
      expect(v.fired).toBe(t.expected);
    }
  });

  it("formats error_rate as percentage and latency as ms", () => {
    const rule = makeRule({
      conditions: [
        { metric: "error_rate", operator: "gt", threshold: 0.1 },
        { metric: "latency_p95_ms", operator: "gt", threshold: 500 },
      ],
    });
    const v = evaluateRule(
      rule,
      [snap("error_rate", 0.42), snap("latency_p95_ms", 1234)],
      NOW
    );
    if (!v.fired) throw new Error("expected fired");
    expect(v.summary).toContain("error_rate=42.0%");
    expect(v.summary).toContain("latency_p95_ms=1234ms");
  });
});

describe("validateRule", () => {
  it("returns no errors for a valid rule", () => {
    const errs = validateRule({
      name: "ok",
      enabled: true,
      conditions: [{ metric: "cost_usd", operator: "gt", threshold: 10 }],
      window: "24h",
      cooldownMinutes: 30,
      severity: "high",
      channels: { pagerdutyRoutingKey: "abc1234567890123456789012345678901" },
    });
    expect(errs).toEqual([]);
  });

  it("requires a non-empty name", () => {
    const errs = validateRule({
      name: "  ",
      enabled: true,
      conditions: [{ metric: "cost_usd", operator: "gt", threshold: 10 }],
      window: "24h",
      cooldownMinutes: 30,
      severity: "high",
      channels: { discordWebhookUrl: "https://discord.com/api/webhooks/x/y" },
    });
    expect(errs.some(e => e.includes("name is required"))).toBe(true);
  });

  it("rejects rule without channels", () => {
    const errs = validateRule({
      name: "x",
      enabled: true,
      conditions: [{ metric: "cost_usd", operator: "gt", threshold: 10 }],
      window: "24h",
      cooldownMinutes: 30,
      severity: "high",
      channels: {},
    });
    expect(errs.some(e => e.includes("at least one channel"))).toBe(true);
  });

  it("rejects rule without conditions", () => {
    const errs = validateRule({
      name: "x",
      enabled: true,
      conditions: [],
      window: "24h",
      cooldownMinutes: 30,
      severity: "high",
      channels: { discordWebhookUrl: "https://discord.com/api/webhooks/x/y" },
    });
    expect(errs.some(e => e.includes("at least one condition"))).toBe(true);
  });

  it("rejects an invalid Discord webhook URL", () => {
    const errs = validateRule({
      name: "x",
      enabled: true,
      conditions: [{ metric: "cost_usd", operator: "gt", threshold: 10 }],
      window: "24h",
      cooldownMinutes: 30,
      severity: "high",
      channels: { discordWebhookUrl: "https://example.com/hook" },
    });
    expect(errs.some(e => e.includes("discordWebhookUrl"))).toBe(true);
  });

  it("rejects out-of-range cooldownMinutes", () => {
    const errs = validateRule({
      name: "x",
      enabled: true,
      conditions: [{ metric: "cost_usd", operator: "gt", threshold: 10 }],
      window: "24h",
      cooldownMinutes: 5000,
      severity: "high",
      channels: { discordWebhookUrl: "https://discord.com/api/webhooks/x/y" },
    });
    expect(errs.some(e => e.includes("cooldownMinutes"))).toBe(true);
  });
});

describe("dryRunRule", () => {
  it("evaluates a rule against a values dict", () => {
    const rule = makeRule({
      conditions: [
        { metric: "cost_usd", operator: "gt", threshold: 10 },
        { metric: "blocked_requests", operator: "gte", threshold: 1 },
      ],
    });
    const v = dryRunRule(rule, { cost_usd: 50, blocked_requests: 1 });
    expect(v.fired).toBe(true);
  });

  it("handles partial values", () => {
    const rule = makeRule({
      conditions: [
        { metric: "cost_usd", operator: "gt", threshold: 10 },
        { metric: "blocked_requests", operator: "gte", threshold: 1 },
      ],
    });
    const v = dryRunRule(rule, { cost_usd: 50 });
    expect(v.fired).toBe(false);
  });
});
