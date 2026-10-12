# RaksHex lean runtime cleanup — 2026-10-12

This is a **source-dependency cleanup**, not a feature removal from the active Agent Firewall.

## Code retired

| File | Why it is safe to propose removal |
| --- | --- |
| `apps/api/services/agentOrchestrator.ts` | Internal 29-role keyword/LLM orchestration implementation, with no reachable imports or routes found in the connected repository's symbol/path searches. Its referenced `agents` directory was not found in the current checked-in root or apps directory. |
| `apps/api/services/aiHealthScore.ts` | An additional 0–100 score engine; source searches found no callers of `calculateAIHealthScore` and no imports of this file. Existing security/cost views and `unifiedRiskScore` remain unchanged. |
| `scripts/keep-alive-pinger.mjs` | Manual Render free-tier keepalive script; no active entrypoint or job reference found. The scheduled workflow is removed in the separate Quick Scan / legacy cleanup PR. |

## Explicitly retained

- `packages/action-control`, the delegated-capability and Agent Firewall primitives
- Credential broker, signed Action Ledger, gateway enforcement and kill switches
- `packages/scanner-core` and the YC #13 OpenAPI contract-diff beta
- `apps/api/services/unifiedRiskScore.ts` and supported risk-score API
- Existing API and worker processes, database migrations and provider integrations

## Why this matters

Unreferenced code increases maintenance, security review and onboarding costs while suggesting capabilities that are not actually wired into a customer path. Removing it reduces source complexity; it does **not** prove lower production spend, runtime latency, or customer outcomes.

## Before merge

1. Validate source and import references on the PR head.
2. Pass formatting, lint, type-check, API/web tests, integration, build, Docker, E2E and Security scan.
3. Do not remove or rewrite database schema/migrations as part of this cleanup.

## Deployment status caveat

The checked-in Express/tRPC + PostgreSQL + Redis/BullMQ monorepo and the active Cloudflare Worker app have different runtime/data designs. Do not overwrite the existing `rakshex-firewall` or `rakshex-web` Workers by uploading Node server sources. A live promotion requires a verified app-to-repository source mapping, a reproducible Cloudflare build/config, compatible data migration plan, a staging smoke run and rollback procedure.
