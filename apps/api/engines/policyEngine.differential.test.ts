/**
 * Differential corpus test — UPDATED post-unification (see CLAUDE.md §5
 * item 0 and docs/POLICY_ENGINE_UNIFICATION.md).
 *
 * HISTORY: `apps/api/engines/policyEngine.ts` used to be a second,
 * independent decision-making engine (rule list, priority order,
 * telemetry-shaped input) running alongside `@rakshex/policy-engine`
 * (compiled document, fixed category order) on a different request path.
 * This file proved they disagreed on 3 of 10 real-world policy intents.
 *
 * CURRENT STATE: `apps/api/engines/policyEngine.ts` is now a thin adapter
 * that delegates every decision to `@rakshex/policy-engine`'s generic
 * `rules` mechanism — there is exactly one decision-making function left.
 * This test now checks something narrower and still worth guarding: can
 * the SAME policy intent, expressed once via the app's historical
 * `PolicyRule[]` shape and once via a `PolicyDocument`'s older *structured*
 * fields (`models`/`tools`/`network`/`data`, predating `rules`), still
 * reach the same decision? For 9 of 10 scenarios, yes — including the two
 * that used to be unfixable gaps (threat-level, cross-category priority),
 * once expressed as `rules` on both sides. One real, honest limitation
 * remains and is called out below: it is a data-shape gap, not an engine
 * disagreement.
 */
import { describe, expect, it } from "vitest";
import { evaluatePolicy as evaluateAppPolicy, type AIEventContext, type PolicyRule } from "./policyEngine";
import { evaluatePolicy as evaluatePackagePolicy } from "@rakshex/policy-engine";
import type { EvaluationContext, PolicyDocument } from "@rakshex/policy-engine";
import { normalizeAction, type CanonicalPolicyAction } from "../services/policyDecisionCompat";

const NOW = new Date("2026-08-06T12:00:00.000Z");

function event(over: Partial<AIEventContext> = {}): AIEventContext {
  return {
    model: "gpt-4o",
    provider: "openai",
    costUsd: 0.02,
    inputTokens: 500,
    prompt: "summarize this document",
    threatLevel: "none",
    agentId: "agt_1",
    timestamp: NOW,
    ...over,
  };
}

function rule(over: Partial<PolicyRule> = {}): PolicyRule {
  return {
    ruleId: "r1",
    name: "test rule",
    priority: 10,
    enabled: true,
    conditions: { operator: "AND", rules: [] },
    action: "block",
    ...over,
  };
}

function doc(over: Partial<PolicyDocument> = {}): PolicyDocument {
  return { version: 1, ...over };
}

interface Scenario {
  name: string;
  appEvent: AIEventContext;
  appRules: PolicyRule[];
  packageDoc: PolicyDocument;
  packageCtx: EvaluationContext;
  /** If set, the two engines are EXPECTED to disagree — this documents a real gap. */
  expectDivergence?: { app: CanonicalPolicyAction; pkg: CanonicalPolicyAction; because: string };
}

const corpus: Scenario[] = [
  {
    name: "denied model",
    appEvent: event({ model: "gpt-3.5-untrusted" }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "model", op: "eq", value: "gpt-3.5-untrusted" }] }, action: "block" })],
    packageDoc: doc({ models: { deny: ["gpt-3.5-untrusted"] } }),
    packageCtx: { model: "gpt-3.5-untrusted" },
  },
  {
    name: "tool requires human approval",
    appEvent: event({ toolCalls: [{ name: "financial.wire_transfer" }] }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "tool_name", op: "eq", value: "financial.wire_transfer" }] }, action: "require_approval" })],
    packageDoc: doc({ tools: { require_approval: ["financial.wire_transfer"] } }),
    packageCtx: { toolName: "financial.wire_transfer" },
  },
  {
    name: "tool outright denied",
    appEvent: event({ toolCalls: [{ name: "shell.exec" }] }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "tool_name", op: "eq", value: "shell.exec" }] }, action: "block" })],
    packageDoc: doc({ tools: { deny: ["shell.exec"] } }),
    packageCtx: { toolName: "shell.exec" },
  },
  {
    name: "PII-shaped keyword flagged for redaction",
    appEvent: event({ prompt: "here is my credit-card number for the refund" }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "promptContains", op: "keyword", value: "credit-card" }] }, action: "redact" })],
    packageDoc: doc({ data: { redact: ["credit_card"], action: "mask" } }),
    packageCtx: { dataLabels: ["credit_card"] },
  },
  {
    name: "hard-blocked data label (secret key)",
    appEvent: event({ prompt: "the key is sk_live_fixture_not_real" }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "promptContains", op: "keyword", value: "sk_live_" }] }, action: "block" })],
    packageDoc: doc({ data: { block: ["api_key"], action: "block" } }),
    packageCtx: { dataLabels: ["api_key"] },
  },
  {
    name: "cost budget exceeded",
    appEvent: event({ costUsd: 12 }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "costUsd", op: "gt", value: 5 }] }, action: "block" })],
    packageDoc: doc({ agent: { max_cost_usd: 5 } }),
    packageCtx: { costUsdSoFar: 12 },
  },
  {
    name: "no rule matches — default allow",
    appEvent: event(),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "model", op: "eq", value: "some-other-model" }] }, action: "block" })],
    packageDoc: doc({ models: { deny: ["some-other-model"] } }),
    packageCtx: { model: "gpt-4o" },
  },
  {
    name: "RESOLVED (was GAP): prompt threat level, expressed via `rules` on both sides",
    // Previously: PolicyDocument's *structured* fields had no threat-level
    // concept, so a threat-level rule was unrepresentable through the
    // package engine's old schema. Now that both sides can use the shared
    // `rules` mechanism, the same condition reaches the same decision.
    appEvent: event({ threatLevel: "critical" }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "threatLevel", op: "gte", value: "high" }] }, action: "block" })],
    packageDoc: doc({
      rules: [
        {
          ruleId: "r1",
          priority: 10,
          enabled: true,
          conditions: { operator: "AND", rules: [{ field: "threatLevel", op: "gte", value: "high" }] },
          action: "deny",
        },
      ],
    }),
    packageCtx: { threatLevel: "critical" },
  },
  {
    name: "RESOLVED (was GAP): cross-category priority, expressed via `rules` on both sides",
    // Previously: the package engine's structured fields hardcoded category
    // order (models before tools) with no per-rule priority, so a tool rule
    // could never outrank a model rule the way the app engine allowed. Now
    // that the package engine's `rules` field carries the same priority
    // concept the app engine always had, an operator who ranks the tool
    // rule above the model rule gets the same outcome on both sides.
    appEvent: event({ model: "gpt-3.5-untrusted", toolCalls: [{ name: "read_only.lookup" }] }),
    appRules: [
      rule({
        ruleId: "tool-alert",
        priority: 1,
        conditions: { operator: "AND", rules: [{ field: "tool_name", op: "eq", value: "read_only.lookup" }] },
        action: "alert_only",
      }),
      rule({
        ruleId: "model-deny",
        priority: 2,
        conditions: { operator: "AND", rules: [{ field: "model", op: "eq", value: "gpt-3.5-untrusted" }] },
        action: "block",
      }),
    ],
    packageDoc: doc({
      rules: [
        {
          ruleId: "tool-alert",
          priority: 1,
          enabled: true,
          conditions: { operator: "AND", rules: [{ field: "toolName", op: "eq", value: "read_only.lookup" }] },
          action: "warn",
        },
        {
          ruleId: "model-deny",
          priority: 2,
          enabled: true,
          conditions: { operator: "AND", rules: [{ field: "model", op: "eq", value: "gpt-3.5-untrusted" }] },
          action: "deny",
        },
      ],
    }),
    packageCtx: { model: "gpt-3.5-untrusted", toolName: "read_only.lookup" },
  },
  {
    name: "REMAINING (data-shape, not an engine gap): AIEventContext carries no network destination",
    // This is NOT an engine disagreement anymore — both sides run the same
    // evaluatePolicy. It is a real, separate limitation: AIEventContext
    // (the AI-telemetry event shape apps/api/engines/policyEngine.ts's
    // callers construct) has no `destination` field at all, because that
    // data doesn't exist at the point telemetry events are built. No rule
    // mechanism can match on a field the input never carries. Network/
    // destination policy is correctly enforced elsewhere — see
    // apps/api/services/gateway/enforcement.ts, which builds its
    // EvaluationContext from the actual outbound request and does have
    // `ctx.destination` — this scenario documents why that split is
    // intentional, not a bug to chase here.
    appEvent: event(),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "destination", op: "eq", value: "evil.example.com" }] }, action: "block" })],
    packageDoc: doc({ network: { deny_domains: ["evil.example.com"] } }),
    packageCtx: { destination: "https://evil.example.com/exfil" },
    expectDivergence: {
      app: "allow",
      pkg: "deny",
      because:
        "AIEventContext (telemetry-event shape) never carries a destination field — gateway/enforcement.ts's own EvaluationContext does, and that is the correct enforcement point for network policy, not this event shape.",
    },
  },
];

describe("policy engine differential corpus", () => {
  for (const scenario of corpus) {
    it(scenario.name, () => {
      const appDecision = evaluateAppPolicy(scenario.appEvent, scenario.appRules);
      const pkgDecision = evaluatePackagePolicy(scenario.packageDoc, scenario.packageCtx);

      const appCanonical = normalizeAction(appDecision.action);
      const pkgCanonical = normalizeAction(pkgDecision.action);

      if (scenario.expectDivergence) {
        // Documented gap: assert it's still there, and still shaped the way
        // we recorded. If this assertion fails, either the gap was closed
        // (great — delete this case) or it changed shape (investigate).
        expect(appCanonical).toBe(scenario.expectDivergence.app);
        expect(pkgCanonical).toBe(scenario.expectDivergence.pkg);
        expect(appCanonical).not.toBe(pkgCanonical);
      } else {
        expect(appCanonical).toBe(pkgCanonical);
      }
    });
  }

  it("every scenario in the corpus is exercised — corpus is not accidentally empty", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  it("reports the agreement rate so a future migration has a baseline number", () => {
    let agree = 0;
    for (const scenario of corpus) {
      const appCanonical = normalizeAction(evaluateAppPolicy(scenario.appEvent, scenario.appRules).action);
      const pkgCanonical = normalizeAction(evaluatePackagePolicy(scenario.packageDoc, scenario.packageCtx).action);
      if (appCanonical === pkgCanonical) agree += 1;
    }
    // 9 of 10 corpus scenarios agree post-unification; 1 is a documented
    // data-shape limitation (AIEventContext has no destination field), not
    // an engine disagreement. If this number moves, the corpus changed —
    // update the comment above to match, don't just bump the number.
    expect(agree).toBe(corpus.length - 1);
  });
});
