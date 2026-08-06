/**
 * Differential corpus test — the two live `evaluatePolicy` engines, run
 * side by side against a shared set of real-world policy intents.
 *
 * See CLAUDE.md §5 item 0 and services/policyDecisionCompat.ts for the full
 * background. Short version: `apps/api/engines/policyEngine.ts` (rule list,
 * priority order, telemetry-shaped input) and `@rakshex/policy-engine`
 * (compiled document, fixed category order, agent/model/tool/network/data
 * shaped input) are both live on different request paths, and nothing today
 * checks whether they agree.
 *
 * The two engines take differently-shaped input, so there is no way to feed
 * one literal object through both. What this file does instead: for each
 * scenario, express the SAME policy intent once in each engine's native
 * shape, run both, normalize both decisions through `normalizeAction()`,
 * and assert on whether they agree.
 *
 * Most scenarios assert AGREEMENT — that's the baseline a shared engine
 * would have to preserve. A few scenarios are marked `expectDivergence` and
 * assert the two engines DISAGREE, on purpose: these are not bugs to fix
 * here, they are the actual gaps a migration has to resolve, and a test
 * that silently started passing on one of these later is exactly the
 * regression this file exists to catch. If a `expectDivergence` case starts
 * agreeing, tighten it into a real regression test and delete the note.
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
    name: "GAP: network destination policy has no app-engine equivalent",
    // AIEventContext has no destination/URL field at all — getFieldValue()
    // falls through to "" for any unrecognised field, so a rule authored
    // against "destination" can never match. A domain block configured
    // through whichever surface writes app-engine rules is silently inert.
    appEvent: event(),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "destination", op: "eq", value: "evil.example.com" }] }, action: "block" })],
    packageDoc: doc({ network: { deny_domains: ["evil.example.com"] } }),
    packageCtx: { destination: "https://evil.example.com/exfil" },
    expectDivergence: {
      app: "allow",
      pkg: "deny",
      because:
        "AIEventContext has no field for network destination — the app engine cannot express or enforce network policy at all, so a domain block is real in the package engine and a no-op in the app engine.",
    },
  },
  {
    name: "GAP: prompt threat level has no package-engine equivalent",
    // PolicyDocument has no threat-level concept anywhere in its schema —
    // only agent/models/tools/network/data. A dashboard rule keyed on the
    // MCP adversarial-intent scanner's threat level cannot be represented
    // as a PolicyDocument at all, so it silently always allows if enforced
    // through the package engine.
    appEvent: event({ threatLevel: "critical" }),
    appRules: [rule({ conditions: { operator: "AND", rules: [{ field: "threatLevel", op: "gte", value: "high" }] }, action: "block" })],
    packageDoc: doc(), // no way to express "threat level" in this schema
    packageCtx: {},
    expectDivergence: {
      app: "deny",
      pkg: "allow",
      because:
        "PolicyDocument has no threat-level field — a rule that blocks on the MCP scanner's threat level is enforceable via the app engine and silently unenforceable via the package engine.",
    },
  },
  {
    name: "GAP: cross-category precedence is not the same relation",
    // Same underlying facts — a denied model AND a tool that should only
    // trigger an alert — routed through both engines. The app engine lets
    // an operator rank an individual RULE above another regardless of its
    // category (priority 1 beats priority 2, no matter what field each
    // rule inspects). The package engine has no such concept: category
    // order is hardcoded (agent limits, then models, then tools, then
    // network, then data) and cannot be overridden per-policy. An operator
    // who ranks the tool rule above the model rule, expecting the alert-only
    // outcome to win, gets exactly that from the app engine and the
    // opposite (hard deny) from the package engine for the identical intent.
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
    packageDoc: doc({ models: { deny: ["gpt-3.5-untrusted"] } }),
    packageCtx: { model: "gpt-3.5-untrusted", toolName: "read_only.lookup" },
    expectDivergence: {
      app: "warn",
      pkg: "deny",
      because:
        "The app engine's per-rule priority let the tool rule (priority 1) win over the model rule (priority 2). The package engine has no per-rule priority — model checks are hardcoded ahead of tool checks — so it denies regardless of how an equivalent policy would be prioritized in the app engine's model.",
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
    // 7 of 10 corpus scenarios agree; 3 are documented structural gaps.
    // If this number moves, the corpus changed — update the comment above
    // to match, don't just bump the number.
    expect(agree).toBe(corpus.length - 3);
  });
});
