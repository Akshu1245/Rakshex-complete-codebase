# RaksHex PostgreSQL Schema

**Dialect:** PostgreSQL 15+  
**ORM:** Drizzle ORM  
**Package:** `@rakshex/database`  
**Migration source of truth:** `packages/database/src/migrate.ts`

> Refreshed 2026-08-28. Do not infer schema currency from a copied migration count in this document. The executable `MIGRATION_ORDER` plus `packages/database/src/migrate.order.test.ts` controls the repository migration contract.

## Overview

RaksHex standardizes on **PostgreSQL**. MySQL is not a supported application database.

Workspace-owned product data is expected to carry/enforce the tenant boundary appropriate to that table. Historical core tables were progressively hardened through later workspace-tenancy migrations; current code/tests, not the earliest schema file alone, define the access contract.

Redis is separate infrastructure used for cache, queue and low-latency control propagation. It is not the durable application database.

## Canonical commands

```bash
# Start local PostgreSQL + Redis
pnpm db:up

# Apply every forward migration in the authoritative order
pnpm db:migrate

# Local-only destructive reset + remigrate
pnpm db:reset

# Synthetic local seed; production is guarded against accidental seeding
pnpm db:seed

# Database package tests
pnpm test:db
```

Do **not** substitute an ad-hoc `drizzle-kit migrate` command for the repository migrator in production. The RaksHex migrator records tags in `rakshex_schema_migrations` and deliberately controls ordering.

Default local Compose URL:

```text
postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex
```

## Migration chain

The current forward order is:

| Order | Migration | Purpose / area |
| ---: | --- | --- |
| 1 | `0000_curly_dark_phoenix` | original core schema |
| 2 | `0001_notifications_and_feature_flags` | notifications / flags |
| 3 | `0002_auth_and_settings` | auth / settings |
| 4 | `0003_enterprise` | enterprise schema foundation |
| 5 | `0004_api_key_hardening` | API-key hardening |
| 6 | `0005_universal_control_plane` | control-plane foundation |
| 7 | `0006_github_installations` | GitHub App installation state |
| 8 | `0007_market_ready_foundation` | workspace/foundation hardening |
| 9 | `0008_auth_resource_model` | auth/resource model |
| 10 | `0009_findings_lifecycle` | findings lifecycle |
| 11 | `0010_p1_workspace_tenancy` | workspace-tenancy hardening |
| 12 | `0011_p3_hot_path_indexes` | hot-path indexes |
| 13 | `0012_compliance_report_types` | compliance report types |
| 14 | `0012_workspace_subscriptions` | workspace subscription model |
| 15 | `0013_token_usage_attribution` | usage attribution |
| 16 | `0014_team_ai_governance` | team AI governance |
| 17 | `0015_governance_extensions` | governance extensions |
| 18 | `0016_shadow_key_lifecycle` | shadow-key lifecycle |
| 19 | `0017_secure_scan_reports` | secure scan reports |
| 20 | `0018_gateway_key_bindings` | gateway key bindings |
| 21 | `0019_workspace_webhooks` | workspace webhooks |
| 22 | `0020_gateway_audit_workspace` | workspace gateway audit |
| 23 | `0021_mcp_server_command` | MCP server command metadata |
| 24 | `0022_agent_firewall` | Agent Firewall / action-control persistence |
| 25 | `0023_mcp_tool_security_findings` | MCP tool security findings |
| 26 | `0024_credential_mediation` | credential-mediation persistence |
| 27 | `0025_openai_billing_reconciliation` | OpenAI billing reconciliation |
| 28 | `0026_versioned_model_prices` | versioned model pricing |
| 29 | `0027_gateway_call_attribution` | gateway-call attribution |
| 30 | `0028_signed_action_receipts` | signed action receipts |

There are two intentionally distinct `0012_*` migrations. Their order is explicit in `MIGRATION_ORDER`; numeric-prefix sorting alone is not the migration algorithm.

### Migration invariant

`packages/database/src/migrate.order.test.ts` enumerates every forward `.sql` file under `packages/database/drizzle` and compares that set with `MIGRATION_ORDER`. A newly added forward SQL file that is not wired into the runner therefore fails the database test instead of silently sitting unused.

Migration files are applied transactionally one at a time and recorded in:

```text
rakshex_schema_migrations(tag, applied_at)
```

## Schema modules

The Drizzle schema is split by concern. Current source files under `packages/database/drizzle` include core/re-export modules plus focused enterprise, billing, pricing, attribution and receipt schema modules.

Important public package exports are declared by `packages/database/package.json`, including:

- `@rakshex/database`
- `@rakshex/database/schema`
- `@rakshex/database/schema-foundation`
- `@rakshex/database/schema-enterprise`
- `@rakshex/database/schema-billing`
- `@rakshex/database/schema-pricing`
- `@rakshex/database/schema-attribution`
- `@rakshex/database/schema-receipts`
- `@rakshex/database/relations`
- `@rakshex/database/migrate`
- `@rakshex/database/seed`

Do not copy table definitions into another package to avoid imports; use the database package exports.

## Major data areas

This is a conceptual map, not an exhaustive substitute for the Drizzle schema.

### Auth and tenancy

Includes users/identities/sessions, workspaces, memberships/invitations, roles/permissions and related auth/resource records.

### API assets and scanning

Includes API keys, projects/repositories/collections, scans/jobs, findings/instances/comments/suppressions and scan-report evidence.

### Policy and governance

Includes policy records/versions/violations, provider/control-plane records, team AI identities/usage/budgets, runtime kill switches, webhooks and audit state.

### Agent Firewall / action control

Later migrations add Agent Firewall/action-control persistence, credential mediation, gateway attribution and signed action receipts. Those tables are part of the current strategic core and must not be omitted from architecture diagrams simply because they did not exist in `0000`/`0007`.

### Usage, pricing and billing

Includes usage/attribution records, versioned model prices, subscription/billing records and provider reconciliation state. A stored/estimated cost is not automatically provider-confirmed billing truth; source/confidence semantics must be preserved by callers.

### MCP and compliance evidence

Includes MCP inventory/security findings and compliance framework/control/report/evidence data. Compliance records support evidence mapping; their presence does not mean RaksHex or a customer is certified.

## Tenant-scoping rule

Every repository/service query that reads or mutates workspace-owned state must prove the requested object belongs to the active workspace instead of trusting a guessed numeric/string ID.

Illustrative SQL shape:

```sql
SELECT *
FROM policies
WHERE workspace_id = $1
  AND id = $2;
```

The actual column casing/names for a specific table come from the Drizzle schema; use repository helpers rather than hand-writing a parallel data-access layer unless required.

Release tests exercise tenant isolation and BOLA-style cross-workspace access on critical paths.

## Seed safety

`pnpm db:seed` inserts **synthetic local-development fixtures**. The canonical seed now rejects `NODE_ENV=production` unless an explicit exact override is deliberately supplied for a controlled environment.

Seed expectations:

- synthetic/example identities only
- no real PII
- no plaintext production credentials
- API-key material stored only in the representation required by the product
- never use the seed as a production account/bootstrap mechanism

Administrative role promotion, when needed, is a separate explicit operator action and should not grant billing entitlements implicitly.

## Docker Compose

Core local services include:

| Service | Image / role | Default port |
| --- | --- | ---: |
| `postgres` | PostgreSQL 15 Alpine | 5432 |
| `redis` | Redis 7 Alpine | 6379 |
| `migrate` | one-shot canonical migration gate | — |
| `api` | RaksHex API | 3000 |
| `worker` | BullMQ worker | — |
| `web` | Next.js web | configured by Compose |

Use `docker compose config`/`docker compose ps` against the current file rather than copying old service/container names from historical reports.

## Backup / restore

Repository-supported commands:

```bash
pnpm db:backup
pnpm db:restore-test
```

CI also performs a PostgreSQL migration plus backup/restore smoke. A production restore still requires operator-owned backups, credentials, storage and recovery verification in the target environment.

## Source-of-truth rule

When this document conflicts with code, use this order:

1. current Drizzle schema and migration SQL
2. `packages/database/src/migrate.ts`
3. `packages/database/src/migrate.order.test.ts`
4. green database/integration CI for the exact commit
5. this document
6. historical audits/release snapshots
