# Competitive battlecard — Archestra

**Updated:** 2026-08-05
**Status:** Positioning hypothesis to prove in live evaluations, not a settled claim. Update monthly per the
market-readiness dossier's "Competitive honesty" rule — do not let this go stale.

## What Archestra is

Open-source (AGPL-3.0), self-hosted "Enterprise MCP Platform for AI Agents." As of this writing: 3,929 commits,
3.8k GitHub stars, 955 forks, 243 releases, CNCF/Linux Foundation member, Terraform provider, Helm chart,
published p95 latency benchmarks, named Fortune-50 reference customers. This is a funded team's multi-year
output — not a side project, and not something RaksHex out-builds on feature count.

Archestra ships nine product pillars: agentic chat (SSO-scoped, per-user identity), apps/skills rendered in
chat, shared "projects" context, a server-side sandboxed agent runtime, a Kubernetes-native MCP orchestrator
with a human approval flow, permission-aware RAG (source-system ACLs enforced on retrieval), an LLM/MCP proxy
that holds real provider keys behind virtual keys, security guardrails, and full OTel observability/cost
tracking.

**Do not claim RaksHex is "better than Archestra" or that any of the above is missing from their product.**
That is not the comparison to make.

## Where they actually overlap with RaksHex

Only one of Archestra's nine pillars — **Security & Guardrails** — covers the same ground as RaksHex's Agent
Firewall. Their mechanism: when a tool call returns data judged sensitive, the *conversation* is marked
"tainted," and risky tool categories (email, web requests) are switched off for the rest of that session.
Deterministic, enforced at the proxy — not a system-prompt request. This targets the same threat class Simon
Willison calls the "lethal trifecta" (private data access + untrusted content + exfiltration channel).

## The actual differentiation

**Archestra governs the session. RaksHex governs the action.**

| | Archestra guardrails | RaksHex Agent Firewall |
| --- | --- | --- |
| Scope of a decision | Whole conversation ("tainted" or not) | One semantic action (`financial.refund`, `code.merge`, ...) |
| Authority model | Tool category on/off | Delegated scope: exact actions, resources, amount, currency, count, time window |
| Delegation | Not a modeled concept | Parent→child attenuation, cryptographically enforced (child can never exceed parent) |
| Record | Traces/logs (OTel) | Hash-chained, idempotency-keyed Action Ledger — tamper-evident by construction |
| Approval | Not a first-class primitive here | One-time-consumption approval grants tied to a specific ledger record |

This is a real, narrow, defensible difference — not a claim that Archestra's approach is worse. Session-level
taint tracking and per-action delegated authority solve adjacent but different problems, and a buyer running
high-consequence agents (payments, prod DB writes, code merges) may want both. **Do not pitch this as "we
replace Archestra."** The honest pitch is: *"If you need to know not just that an agent touched sensitive
data, but exactly what business action it was authorized to take, by whom, within what limit, with a
tamper-evident record of the decision — that's what RaksHex adds."*

## Why this claim doesn't survive due diligence yet

A technical evaluator's first question will be: **"What stops the agent from just calling Stripe directly
with its own API key, skipping RaksHex entirely?"**

Today the honest answer is: nothing. `evaluate()` records the correct decision, but RaksHex does not yet
mediate the credential the agent uses to execute the action — the exact "Gateway bypass" risk the market
dossier lists as **Critical** impact, and the same threat class Archestra addresses structurally (virtual
keys; real provider keys never leave their vault).

**This is the single highest-leverage build item for making the differentiation story real, not the P1 list
in the abstract.** Everything else on the roadmap (cumulative/sequence controls, policy replay, enterprise
SSO) is already partially built or is polish. Credential mediation is the one gap that, if left open, turns
"deterministic per-action authority" into a claim that only holds when the agent chooses to cooperate —
which is not a security boundary.

## Recommended next build priority

1. **Credential mediation** (P0/P1, was already flagged as open in `docs/GAP_INVENTORY.md` item M and the
   Agent Firewall P1 list). Scope: agent never holds the real Stripe/GitHub/Postgres credential; it receives
   a short-lived, scoped credential (or the call is proxied) only after `evaluate()` returns `ALLOW`.
   Without this, `authorizeAndRun()` in the SDK is advisory, not enforced.
2. Everything else stays where the dossier already put it. Do not reprioritize the rest of the roadmap off
   this one comparison.

## Sources

- https://archestra.ai/ (fetched 2026-08-05)
- https://github.com/archestra-ai/archestra (fetched 2026-08-05: 3,929 commits, 3.8k stars, 955 forks, 243
  releases, AGPL-3.0, CNCF/Linux Foundation member)
- https://archestra.ai/docs/platform-ai-tool-guardrails, https://archestra.ai/docs/platform-lethal-trifecta
- https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ (referenced by Archestra's own docs)

Recheck before reusing in an investor deck or customer conversation — competitor capabilities change; this
is a snapshot, not a permanent fact.
