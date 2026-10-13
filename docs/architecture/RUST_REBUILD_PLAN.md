# RaksHex Rust Rebuild — Architecture and Market Plan

**Decision:** Rebuild the backend toward one Rust modular monolith using Axum/Tokio, keeping PostgreSQL as system of record, existing Cloudflare edge routing and Next.js frontend. Migration is incremental, not a production cutover. **No claim of improved latency or fewer crashes is justified until measured.**

**Starting point (October 13, 2026):** The original production-capable backend is Express/tRPC/TypeScript. It contains Agent Firewall policy, delegated authority, credential broker, signed receipts, billing, SSO, gateway, MCP and scanning. The Rust `action-core` here is an **isolated algorithm prototype only**, not deployed or live, with shared TS/Rust parity tests.

## Target system

```text
Users/Agents/SDK/CLI
        |
Cloudflare edge / stable external API routes
        |
   Rust Axum API (modular monolith; phased replacement)
        |-- Auth/session/tenant isolation
        |-- Action-control + policy (Rust action-core)
        |-- Credential broker + signed receipts
        |-- Gateway + MCP + scanning
        |-- Billing/SSO/admin
        |-- Observability + rate/backpressure controls
        |
        +---- PostgreSQL (canonical, transactional)
        +---- Redis/BullMQ initially; replace only when justified
        +---- Rust bounded workers for scanning / async workloads
        |
External providers (egress only after broker authorization)

Migration period: existing Express API remains available for any
feature not yet covered and proven by Rust.
```

Do not relocate, delete or switch any live customer state as part of bootstrapping.

## Locked engineering rules

1. **Security contract first:** deny-by-default for unknown actions, authoritative revocation, scoped credentials, approvals, signed receipts and safe/idempotent egress. Preserve shadow/enforce semantics but never authorize egress solely from shadow-mode `effectiveDecision`.
2. **Transactional correctness first:** concurrent spend limits, receipt-chain sequencing, idempotency and uniqueness must be proven under load; no cache-only authorization for sensitive actions.
3. **Single API contract:** OpenAPI/JSON schemas for Rust endpoints, compatibility adapters for existing clients and tRPC callers; do not make the UI migrate simultaneously.
4. **One Postgres source of truth:** migrate schema with forward/backward-compatible migrations and backups, not opportunistic D1 conversion.
5. **Bounded load:** connection pools, concurrency limits, timeouts, cancellation, worker isolation, retries + DLQ and admission control; prefer stateless API processes.
6. **Observable rollouts:** per-route request traces, 429/5xx rates, p50/p95/p99 latency, connection exhaustion, queue lag, receipt lag, and end-to-end correctness. Feature flags, canary and immediate rollback.
7. **Small team discipline:** one module/one PR at a time; clear docs, no speculative microservices or premature distributed architecture.

## Milestones, in dependency order

- **R0 — Baseline and contracts:** freeze TypeScript behavior, map endpoints, DB tables, secrets and queue consumers, add representative security regression vectors. Snapshot current performance with real staging loads.
- **R1 — Rust security core (this PR):** pure Rust port of deterministic `evaluateAction`, shared fixtures verified against both TS and Rust; CI enforces tests and formatting. **Zero production routing changes.**
- **R2 — Rust API skeleton:** Axum/Tokio, health/readiness, structured traces, consistent errors, request/tenant auth, bounded timeouts, deployment artifact. Existing TypeScript remains the upstream source until parity passes.
- **R3 — Authoritative data/receipts:** SQLx/Postgres pools, schema compatibility, transaction-safe ledger and limits, replay/idempotency, credential mediation, receipts verified across languages. Fail closed on outages.
- **R4 — Migrate features one-by-one:** agent policy/approval APIs first, then gateway/MCP/scan/workers; billing/SSO and customer-sensitive migrations last. Use route-level feature flags, canary/rollback and complete E2E tests.
- **R5 — Production certification:** staging failure injection (Postgres, Redis/queue, provider, control plane), concurrency, p99 latency, receipt chain verification, backups/restore, penetration review, staged deployment. Retire Express only once parity and all dependencies are proven.
- **R6 — Market:** focused ICP (teams shipping tool-using AI agents), one undeniable demo (unauthorized action blocked + signed evidence), customer discovery/pilots, documentation and onboarding, production SLAs and support, then YC application and traction evidence.

## Explicitly out of scope of this initial Rust PR

- No new Rust HTTP listener, database connector, container or service yet.
- No rewiring of old TypeScript production traffic.
- No changes to Cloudflare production Workers or DNS.
- No database, queue, billing or SSO migration.
- No speculative performance percentages or zero-crash guarantees.
- No need to rewrite the React/Next.js UI in Rust.

## Initial policy-engine parity limitations

The shared fixtures cover baseline authorization, frozen/no authority, scoping and amounts, unknown writes, policy deny/approval, cumulative controls, dangerous sequences, expiry and shadow mode. They do not establish full behavioral equivalence for every malformed input, timezone, rounding boundary or concurrency case. The Rust implementation deliberately **denies malformed authority timestamps**; that hardening must be reviewed before production deployment. Next gates: differential fuzzing, high-value TypeScript vectors and adversarial race tests.

Reference: `packages/action-control/src/evaluate.ts`, `authority.ts`, `types.ts` and `rust/action-core`.
