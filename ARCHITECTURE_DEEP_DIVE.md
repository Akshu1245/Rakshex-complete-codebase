# RaksHex Architecture Deep Dive

> **Refreshed:** 2026-08-28. This document explains implemented architecture. It does not assert certifications, patent status, production benchmarks, or scale limits that are not demonstrated by the repository release evidence.

For the compact canonical map, see `docs/ARCHITECTURE.md`. For current engineering status and claim boundaries, read `CLAUDE.md` first.

## 1. System context

RaksHex is an **AI Action Control Plane** with scanning and governance surfaces around a shared API/control plane.

```text
Browser / VS Code / CLI / GitHub / Node SDK / Python SDK
                          |
                          v
                 apps/api (Express + tRPC)
                   /        |         \
                  v         v          v
            PostgreSQL    Redis      BullMQ workers
                  |         |
                  |         +--> low-latency control/cache/queue paths
                  +------------> durable tenant, policy, audit and usage state

RaksHex-routed provider/action traffic
                          |
                          v
          Agent Firewall / gateway enforcement
                          |
             ALLOW -------+------- DENY
               |                    |
       credential mediation       no provider/action execution
               |
               v
          provider/action target
```

Primary repository applications:

- `apps/api` — API, authentication, tenancy, gateway and enforcement paths
- `apps/web` — product website and operator dashboard
- `apps/worker` plus API queue workers — asynchronous jobs
- `apps/vscode-extension` — editor integration
- `apps/cli` — local/CI scanning

Primary packages:

- `@rakshex/action-control` — Agent Firewall/delegated-authority primitives
- `@rakshex/policy-engine` — policy evaluation
- `@rakshex/database` — PostgreSQL schema/migrations
- `@rakshex/scanner-core` — deterministic scanning
- `@rakshex/pricing-engine` — versioned pricing/cost calculation
- `@rakshex/sdk` — Node AgentGuard + Agent Firewall client
- `rakshex-agentguard` source — Python AgentGuard + Agent Firewall client
- `@rakshex/mcp-security` — MCP security analysis
- `@rakshex/compliance-engine` — evidence/control mapping

## 2. Agent Firewall: the strategic action path

The core design point is to authorize a consequential **action before it executes**, rather than only observing the surrounding AI session.

Canonical flow:

1. An agent proposes a semantic action such as `financial.refund`.
2. RaksHex resolves the agent/workspace identity and delegated capability constraints.
3. The policy engine evaluates the action context.
4. A `DENY` stops the RaksHex-mediated execution path.
5. An `ALLOW` may release a centrally mediated credential for the authorised operation.
6. Authorization/action evidence is recorded in the Action Ledger/audit path.

Delegated authority is attenuated: a child capability should not gain authority its parent did not have.

### Enforcement boundary

A RaksHex decision governs traffic/actions that actually pass through the RaksHex enforcement path. It is not truthful to claim that a gateway kill switch universally disables traffic sent directly to a provider outside RaksHex. Provider-native controls are used only where an adapter and customer-authorised provider capability actually support them.

## 3. LLM gateway governance

The repository contains OpenAI-compatible and Anthropic Messages gateway paths. A governed request can be checked against:

- workspace/identity/project/agent kill-switch state
- applicable hard gateway budget
- supported policy constraints
- workspace-scoped credentials and attribution

Durable kill-switch state is stored in PostgreSQL and the low-latency propagation path uses Redis. Enforcement reconciles durable state so a cache miss must not silently clear a durable active switch.

Budget enforcement distinguishes modes:

- `gateway` — hard enforcement on RaksHex-routed traffic
- `provider_native` — only when the provider adapter supports a real provider-side control
- `monitor_only` — visibility/alerting without pretending RaksHex blocked provider traffic

## 4. Team AI governance and provider adapters

Provider visibility is capability-specific. The control plane normalizes supported seat, usage and spend information into workspace-scoped records while retaining source/confidence semantics.

Valid capability outcomes include `NOT_IMPLEMENTED`, `NOT_CONFIGURED`, unsupported/unavailable states, partial syncs, imported data and estimates. Those are deliberate honesty states, not UI failures that should be converted into fake success.

Usage reporting supports bounded windows (`since` and `until`) and aggregates by member, provider, model and date.

## 5. Scanning flow

A collection/security scan follows this broad path:

1. Parse an imported Postman/OpenAPI-compatible input through size/structure limits.
2. Normalize endpoints and relevant security metadata.
3. Run deterministic scanner rules from `@rakshex/scanner-core`.
4. Persist workspace-scoped scan/findings state.
5. Expose findings through the web, CLI, VS Code and supported GitHub paths.

Scanner findings are evidence produced by implemented rules. They are not a substitute for a formal penetration test or certification.

## 6. Policy architecture

There are two related policy inputs without a second competing evaluator:

- dashboard-authored `policy_rules`
- static YAML policy-as-code documents

Dashboard rules pass through the API adapter into `@rakshex/policy-engine`, preserving active state, action pattern, deterministic priority/order, threat-level constraints, condition and effect. YAML policy-as-code has its own input schema but uses the same canonical policy-engine package for evaluation behavior.

## 7. Credential and secret handling

Important implemented boundaries:

- workspace/API keys are hashed where the product only needs verification
- stored provider/control-plane credentials use the encrypted vault path
- `RAKSHEX_VAULT_KEY` is a production-required root secret
- VS Code uses SecretStorage for extension credentials
- production configuration must provide explicit secrets rather than repository-known defaults
- server secrets must never be exposed through `NEXT_PUBLIC_*`

Credential mediation is what makes an Agent Firewall `DENY` meaningful for mediated operations: a denied action does not receive the protected credential through that path.

## 8. Data and tenancy

The database is **PostgreSQL**, not MySQL. Redis is used for cache/queue/control propagation, and BullMQ provides asynchronous job processing.

Core data classes include:

| Class | Examples | Main handling expectation |
| --- | --- | --- |
| Secrets | workspace keys, provider credentials | hash or encrypt; redact from logs |
| Tenant identity | users, memberships, provider identities | workspace-scoped authorization |
| Governance telemetry | tokens, cost, provider/model metadata | workspace scoped; source/confidence retained |
| Findings | scan evidence, MCP/security results | workspace scoped |
| Action evidence | authorization decisions/receipts/ledger records | durable audit/evidence path |

Tenant isolation and authorization are release-gate concerns; a passing UI alone is not evidence of isolation.

## 9. Runtime and deployment baseline

Declared runtime baseline:

- Node.js 24.x
- pnpm 10.32.1
- PostgreSQL
- Redis + BullMQ
- Python SDK supports Python >=3.10

Container targets exist for API, worker and web. The repository release workflow builds/scans the production images, applies migrations to a real PostgreSQL service, performs backup/restore smoke testing, and runs Playwright smoke coverage.

Use the canonical migration command:

```bash
pnpm db:migrate
```

`packages/database/src/migrate.order.test.ts` protects the explicit migration order from silently omitting a forward SQL migration.

## 10. Observability and failure behavior

The API provides health/readiness endpoints and metrics instrumentation. Optional OpenTelemetry/Sentry integrations are configuration-dependent.

Important fail-closed expectations include:

- production startup rejects missing critical configuration
- production queue/enforcement code must not silently switch to development in-memory behavior when Redis is absent
- gateway enforcement state/database failures should not become implicit `ALLOW`
- unsupported provider-native operations should remain explicit unsupported states

## 11. Evidence and performance claims

This document intentionally does **not** publish fixed numbers such as “<5 ms overhead,” “50,000 users,” or fixed concurrent-scan capacity without a reproducible benchmark tied to an exact commit and environment.

Likewise, cost data can contain exact provider-reported values, imported values or estimates depending on source. UI/API surfaces must preserve that distinction rather than presenting every number as provider-verified billing truth.

## 12. Compliance and intellectual-property claims

The repository provides compliance evidence/control mapping. It does **not** itself prove SOC 2, ISO, GDPR, EU AI Act or other certification/compliance status.

This repository documentation makes **no patent-status claim**. Any patent/application statement must be supported by separately verified legal records before it appears in public product copy.

## 13. Release proof

Architecture being implemented is not the same as a release being safe to promote. For the exact commit being promoted, require both GitHub **CI** and the independent **Security scan** to be green. The release gate covers formatting, lint, type checking, Node tests, Python SDK tests, PostgreSQL/Redis integration, security tests, builds, Docker, migration/restore, Playwright smoke, dependency audit, secret scan, SBOM and container scanning.

External production configuration—DNS/TLS, SMTP, provider/payment credentials, monitoring ownership, legal/tax sign-off and the later Vercel promotion—remains separate from repository correctness.
