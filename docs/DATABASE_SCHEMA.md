# Rakshex PostgreSQL Schema

**Dialect:** PostgreSQL 15+  
**ORM:** Drizzle ORM (`drizzle-orm` + `drizzle-kit`)  
**Package:** `@rakshex/database`  
**Migrations:** `packages/database/drizzle/0000_*.sql` … `0007_*.sql`

---

## Overview

Rakshex standardizes on **PostgreSQL**. MySQL is not supported for new work.

Multi-tenant isolation is **workspace-scoped**: new foundation tables carry `workspace_id` (integer FK → `workspaces.id`). Legacy tables gained nullable `workspace_id` in migration `0007` for gradual backfill.

---

## Migration history

| Tag                                    | Purpose                             |
| -------------------------------------- | ----------------------------------- |
| `0000_curly_dark_phoenix`              | Core product tables                 |
| `0001_notifications_and_feature_flags` | Notifications / flags               |
| `0002_auth_and_settings`               | Auth tokens, sessions, audit        |
| `0003_enterprise`                      | Enterprise extensions               |
| `0004_api_key_hardening`               | API key hardening                   |
| `0005_universal_control_plane`         | Control plane                       |
| `0006_github_installations`            | GitHub App installs                 |
| `0007_market_ready_foundation`         | Market-ready tables + FKs + uniques |

Tracking table: `rakshex_schema_migrations` (tag, applied_at).

Reversible: `0007_market_ready_foundation.down.sql` drops additive foundation objects only.

---

## Commands

```bash
# Start Postgres + Redis
pnpm db:up

# Apply all migrations from zero
pnpm db:migrate

# Drop public schema + re-migrate (local only)
pnpm db:reset

# Synthetic local seed (no real PII)
pnpm db:seed

# Integration tests (needs running Postgres)
pnpm test:db
```

Default local URL:

```text
postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex
```

---

## Required foundation tables

### Auth & tenancy

| Table                   | Notes                                          |
| ----------------------- | ---------------------------------------------- |
| `users`                 | Legacy + current auth principal                |
| `identities`            | Provider links (email/google/github/oidc/saml) |
| `sessions`              | Foundation sessions (hashed tokens)            |
| `user_sessions`         | Legacy sessions (kept for app compat)          |
| `verification_tokens`   | Email / MFA verification                       |
| `password_reset_tokens` | Password reset                                 |
| `workspaces`            | Tenant boundary                                |
| `workspace_members`     | Membership + role (unique workspace+user)      |
| `workspace_invitations` | Pending invites                                |
| `roles`                 | System + workspace roles                       |
| `permissions`           | Global permission catalog                      |
| `role_permissions`      | Role ↔ permission                              |

### API keys & assets

| Table                 | Notes                                          |
| --------------------- | ---------------------------------------------- |
| `api_keys`            | Hashed secrets, `rk_*` prefix, workspace-owned |
| `projects`            | Workspace projects                             |
| `repositories`        | Linked code repos                              |
| `collections`         | API collections (legacy; + `workspace_id`)     |
| `collection_versions` | Versioned collection payloads                  |

### Scanning & findings

| Table                  | Notes                                     |
| ---------------------- | ----------------------------------------- |
| `scans`                | Scan records (+ `workspace_id`)           |
| `scan_jobs`            | Queue jobs, idempotency key per workspace |
| `findings`             | Findings (+ `workspace_id`)               |
| `finding_instances`    | Occurrences / fingerprints                |
| `finding_comments`     | Discussion                                |
| `finding_suppressions` | Suppressions with expiry                  |
| `accepted_risks`       | Formal risk acceptance                    |

### Policy & governance

| Table                   | Notes                                   |
| ----------------------- | --------------------------------------- |
| `policies`              | Policy-as-code documents                |
| `policy_versions`       | Versioned YAML/JSON docs                |
| `policy_violations`     | Runtime violations                      |
| `integrations`          | GitHub/Slack/etc.                       |
| `notification_channels` | Delivery channels                       |
| `notifications`         | In-app notifications (+ `workspace_id`) |
| `kill_switch_events`    | Legacy kill-switch audit                |
| `audit_logs`            | Canonical append-only audit trail       |

### Agent / cost / billing / compliance

| Table                   | Notes                              |
| ----------------------- | ---------------------------------- |
| `agent_runs`            | Agent execution runs               |
| `agent_steps`           | Steps within a run                 |
| `llm_requests`          | LLM call telemetry                 |
| `tool_calls`            | Tool invocations                   |
| `usage_events`          | Metered usage                      |
| `pricing_versions`      | Versioned model prices             |
| `cost_records`          | Cost lines (estimate vs confirmed) |
| `subscriptions`         | Billing subscriptions (legacy)     |
| `invoices`              | Invoices                           |
| `compliance_frameworks` | Framework catalog                  |
| `compliance_controls`   | Controls per framework             |
| `compliance_evidence`   | Workspace evidence                 |

Enterprise-only tables remain in `schema-enterprise.ts` (Azure, control plane, etc.).

---

## Tenant scoping rule

```sql
-- Always filter workspace-owned tables:
SELECT * FROM policies WHERE workspace_id = $1;
```

Integration tests assert:

1. Same-named policies in two workspaces do not leak across `workspace_id` filters.
2. FK rejects `api_keys` for non-existent workspaces.
3. Unique constraints on `(workspace_id, slug)` for projects, etc.

---

## Seed data

`pnpm db:seed` inserts **synthetic** fixtures only:

- Email domain: `@example.local`
- Name: `Local Dev User`
- Workspace slug: `local-dev`
- API key material is hashed; plaintext is not stored

Never use real personal information in seeds.

---

## Docker Compose

`docker-compose.yml` services:

| Service    | Image                | Port |
| ---------- | -------------------- | ---- |
| `postgres` | `postgres:15-alpine` | 5432 |
| `redis`    | `redis:7-alpine`     | 6379 |

Credentials: user/db/password `rakshex` (local default).

---

## Schema sources

```
packages/database/drizzle/
  schema.ts              # Core + re-exports
  schema-foundation.ts   # Market-ready additive tables
  schema-enterprise.ts   # Enterprise extensions
  relations*.ts
  0000_…sql … 0007_….sql
  0007_….down.sql
```

Drizzle config: `packages/database/drizzle.config.ts` (dialect: `postgresql` only).
