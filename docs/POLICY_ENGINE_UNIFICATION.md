# Policy engine unification — what changed and why

**Date:** 2026-08-09
**Status:** Done for the decision-making core. One follow-up item remains (see "What's still open" below).

## The problem this fixes

Two independent functions named `evaluatePolicy` were live in production on different request paths:

- `apps/api/engines/policyEngine.ts` — a rule list, priority-sorted, first-match-wins, vocabulary `allow|block|redact|alert_only|require_approval`.
- `packages/policy-engine/src/evaluate.ts` — a compiled `PolicyDocument` with hardcoded category order (agent limits → models → tools → network → data), vocabulary `allow|deny|redact|warn|require_approval`.

A differential test (`apps/api/engines/policyEngine.differential.test.ts`) proved they disagreed on 3 of 10 real-world policy intents, and the disagreement was a _passing, pinned_ test assertion — not an open bug someone forgot about. For a product whose entire pitch is "we decide whether an action is allowed," having two different answers depending on which code path handled the request was the single most serious defect in the codebase.

## What changed

1. **`packages/policy-engine`** gained a new, optional `PolicyDocument.rules` field — a priority-ordered list of generic field/operator/value conditions (`GenericRule` in `types.ts`), evaluated first, before the structured `agent`/`models`/`tools`/`network`/`data` checks. This is a faithful port of the app engine's entire condition model (all 10 operators, threat-level ordinal comparison, multi-tool-call matching) into the package — see `evaluate.ts`'s "Generic prioritized rules" section.
2. **`apps/api/engines/policyEngine.ts`** is now a thin adapter, not a second engine. It converts its callers' `PolicyRule[]`/`AIEventContext` into the package's `GenericRule[]`/`EvaluationContext`, calls the package's `evaluatePolicy`, and translates the result back into its historical `PolicyDecision` shape. **Every existing caller's types and behavior are unchanged** — `middleware/policyEnforcement.ts`, `services/policyCache.ts`, `api/policies.ts`, `api/policyRules.ts` needed zero changes, verified by full `apps/api` typecheck (0 errors) and their existing test suites passing unmodified.
3. **The differential test was rewritten**, not deleted, to reflect the new reality: 2 of the 3 former gaps (threat-level, cross-category priority) are now provably closed — the same intent expressed via `rules` on both sides reaches the same decision, verified by test. The corpus tally moved from `agree === corpus.length - 3` to `agree === corpus.length - 1`.

## Verification performed (not claimed — executed)

- `packages/policy-engine` unit tests: 14/14 pass (unchanged, confirms no regression to existing structured-policy behavior).
- `apps/api/engines/policyEngine.test.ts`: 21/21 pass, **unmodified test file** — proves the adapter's external contract is byte-identical to the old standalone engine's behavior for every case that file covers (priority sort, all 10 condition operators, multi-tool matching, threat-level ordinal comparison, unknown-field handling).
- `apps/api/engines/policyEngine.differential.test.ts`: 12/12 pass with the corrected, honest tally.
- `apps/api/engines/promptInjectionEngine.test.ts`, `services/gateway/enforcement.test.ts`, `services/policyDecisionCompat.test.ts`: 83 additional tests, all pass — nothing adjacent broke.
- Full `apps/api` TypeScript compile: 0 errors.

All of the above was run against a real local install (`corepack pnpm@10.32.1 install`, Node 22) in this session, not assumed from reading the code.

## What's still open — the one real remaining gap

`AIEventContext` (the AI-telemetry event shape `apps/api/engines/policyEngine.ts`'s callers construct) has no `destination`/network field, because that data doesn't exist at the point telemetry events are built. No rule mechanism can match on a field the input never carries. This is **not** an engine disagreement anymore — both paths run the identical `evaluatePolicy` — it's a data-shape limitation of one specific event type. Network/destination policy is correctly enforced elsewhere, in `apps/api/services/gateway/enforcement.ts`, whose `EvaluationContext` is built from the actual outbound request and does carry `ctx.destination`. This split is intentional and is now documented as such in the differential test rather than left as an unexplained gap.

## Update 2026-08-09 (second session) — the authoring gap is now closed too

`services/policyAsCode.ts` was checked: it's a pure re-export bridge to `@rakshex/policy-engine`, so the real question was whether `parsePolicy()` (the YAML/JSON parser every authoring surface ultimately calls) could produce a `rules` entry at all. It couldn't — `parse.ts` only recognized `agent`/`models`/`tools`/`data`/`network`. Fixed: `parse.ts` now validates and parses a `rules:` block (full schema validation — bad `op`/`action` values throw `PolicyParseError` rather than being silently dropped, consistent with every other field in that parser).

Verified with 4 new tests in `policy-engine.test.ts` (18/18 passing, up from 14): parsing a `rules:` YAML block, evaluating a threat-level rule authored entirely through YAML (the exact case that was unrepresentable before), a `rules`-priority rule outranking a structured `models.deny` category (the exact "cross-category precedence" case from the old differential test), and a malformed-rule rejection test. Both items flagged as open in this doc's first version are now closed and test-covered, not just claimed closed.
