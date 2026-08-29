# Rakshex V1 Product Lock — 2026-08-29

This document locks product scope for the pre-market build. It is a product/implementation plan, not a replacement for `CLAUDE.md` as the verified repository status source.

## Product position

Rakshex is the live API and AI control plane for development teams. It unifies usage, spend, provider/team/agent attribution, credentials, security policy, runtime action control, and scoped kill switches across AI and API services, with VS Code as the daily developer surface and the web application as the administration surface.

The Agent Firewall is the enforcement engine inside the broader control plane; it is not the whole product.

## Locked V1 pillars

1. Universal API/AI control plane
2. Live usage and cost tracking
3. Team/user/project/agent attribution
4. Credential and secret security
5. Action-level Agent Firewall and policy engine
6. Runtime gateway and scoped kill switches
7. VS Code + web unified experience
8. Adaptive AI budgeting

No new major product pillar should be added before launch. Research findings go to the post-launch backlog unless they reveal a critical correctness/security problem.

## What is already in the repository

The existing codebase already contains substantial foundations that should be completed rather than replaced:

- team AI identities and workspace-member linkage
- normalized provider usage ingestion and per-member/provider/model summaries
- member/workspace budgets and gateway enforcement
- scoped kill-switch state
- provider accounts, credential inventory and encrypted credential storage
- Agent Firewall, delegated authority, credential mediation and Action Ledger
- VS Code control-plane surface
- Postman/OpenAPI scanning and secret/security findings
- Redis/BullMQ-backed runtime infrastructure

## New implementation added by this lock

### Adaptive AI Budgeting core

`apps/api/services/teamGovernance/adaptiveBudgeting.ts`

Deterministic planning for:

- locked allocations
- shareable allocations
- pooled allocations
- protected member reserves
- bounded borrowing
- approval thresholds
- priority-gated emergency reserves
- exact shortfall reporting

The planner is intentionally pure and does not mutate balances. Returned reservation slices must be committed using the existing atomic reservation/transaction boundary so concurrent requests cannot double-spend capacity.

Launch behavior should be deterministic policy, not opaque AI reallocation.

### Modality-neutral usage units

`apps/api/services/teamGovernance/usageUnits.ts`

Rakshex must not treat tokens as a universal resource. Financial spend is the primary cross-provider control unit while provider-native usage remains visible using normalized units such as:

- input/output tokens
- requests
- credits
- images
- audio seconds
- video seconds
- GPU seconds
- bytes/bandwidth
- code completions

This preserves the original product vision across text, code, voice, image, video, cloud and generic APIs.

## Final provider strategy

### Tier 1 launch targets

- OpenAI
- Anthropic
- OpenRouter
- Azure OpenAI
- Gemini / Vertex
- AWS Bedrock
- GitHub Copilot
- ElevenLabs
- OpenAI-compatible endpoints
- generic HTTP/API
- MCP

Providers are capability-driven. A connector must state honestly whether it is:

- monitored: provider/admin usage visibility only
- instrumented: Rakshex receives runtime telemetry
- controlled: traffic/credentials pass through an enforceable Rakshex boundary

Never claim a hard kill switch from read-only usage APIs.

## Required runtime event identity

Every controlled/instrumented usage event should converge on these dimensions where available:

- organization/workspace
- team
- principal/user/service account
- agent
- project
- credential fingerprint/id
- provider/account
- model/product
- semantic action
- normalized usage measurements
- actual/estimated/provider-reported cost confidence
- policy/authority version
- outcome

Do not fall back to workspace-owner attribution when the actual principal is known.

## Adaptive AI Budgeting V1 behavior

The V1 module is intentionally narrow:

- company/workspace budget
- team budget
- user budget
- project budget
- agent budget
- guaranteed allocation
- shared pool
- temporary/burst allocation
- request additional capacity
- deterministic auto-borrow within limits
- approval above configured threshold
- atomic reservation before provider execution
- settlement against actual cost
- hard stop when no approved capacity exists
- approved cheaper-model fallback as a policy option
- complete audit trail for allocation/borrow/reservation decisions

Post-launch only:

- autonomous forecast-based redistribution
- internal capacity marketplace UI
- advanced ML optimization
- automatic model-cost optimization recommendations
- complex cross-department rebalancing

## Competitor/open-source conclusions

Use external projects selectively by layer:

- observability/detection (e.g. ADR/Numbat-style sensors): integrate/adapt signals and benchmarks
- action authorization/firewall projects: treat as competitors/reference implementations; do not outsource the Rakshex policy/enforcement core
- identity platforms: partner/connect rather than rebuild enterprise IAM
- research: adapt validated concepts behind feature flags and tests

Do not introduce another independent policy engine.

## Market-readiness execution order

### P0 — Trustworthy production baseline

- fix any failing API production deployment/status check
- frozen lockfile/workspace consistency
- full E2E smoke path
- secret scan/CodeQL/high-severity CI clean
- production DB/Redis/queue health
- remove stale or unverifiable marketing claims

### P1 — Attribution correctness

- propagate actual principal/team/project/agent/credential IDs through runtime usage
- eliminate owner-as-proxy spend attribution
- test cross-workspace/identity isolation

### P2 — Provider adapter completion

- implement capability-honest Tier 1 connectors
- add OpenRouter and ElevenLabs to the real control-plane connector path
- add generic HTTP/API normalization

### P3 — Usage normalization persistence

- persist modality-neutral measurements alongside financial spend
- surface exact/provider/estimated confidence

### P4 — Adaptive AI Budgeting persistence/enforcement

- persist allocation pools and transfer/reservation audit records
- wire `planAdaptiveCapacity()` into the existing atomic reservation boundary
- settle actual provider cost after execution

### P5 — Scoped runtime controls

- workspace/provider/project/agent/credential kill switches
- configurable fail-open/fail-closed behavior by action criticality
- credential-brokered enforcement for controlled mode

### P6 — Flagship VS Code control plane

Surface, without requiring the developer to live in the web dashboard:

- live spend and remaining budget
- provider health/usage
- per-user/agent/project attribution
- shared capacity and pending approvals
- leaked/shared credential findings
- recent blocked actions
- scoped kill controls

### P7 — Web admin experience

Keep navigation focused on:

- Overview
- Live Usage
- Providers
- Teams
- Agents
- Credentials
- Security
- Policies
- Action Ledger
- Budgets
- Integrations
- Settings

## Launch acceptance test

Rakshex is ready for first external customers only when these flows work end-to-end with real provider accounts:

1. Connect provider -> see real usage.
2. Runtime request -> attribute to the correct principal/agent/project.
3. Spend -> update immediately from controlled traffic.
4. Budget exhausted -> next controlled request is denied before provider spend.
5. Shareable capacity available -> reserve it atomically according to policy.
6. Leaked/shared key -> identify credential safely by fingerprint and alert.
7. Scoped kill -> stop only the intended workspace/provider/project/agent/credential path.
8. VS Code -> show the same authoritative state as the web control plane.
9. Audit -> explain who/what/why/credential/policy/cost/outcome for a consequential action.
10. Privacy -> no raw prompt or plaintext provider credential appears in normal telemetry/logging/UI.

Until these are demonstrated, do not describe the repository as fully GA market-ready.
