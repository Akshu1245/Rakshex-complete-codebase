# Repository audit (source of truth)

**Date:** 2026-07-12  
**Branch:** `akshu1245/feat/launch-control-plane`  
**Method:** Filesystem inventory, code inspection, automated tests. Documentation is secondary to code + tests.

---

## 1. Monorepo layout (actual)

| Path                         | Role                                    | Notes                                   |
| ---------------------------- | --------------------------------------- | --------------------------------------- |
| `apps/api`                   | Express + tRPC API, queues, services    | Primary backend — **not missing**       |
| `apps/web`                   | Next.js dashboard                       | Large UI surface; some pages Beta       |
| `apps/cli`                   | CLI scan / policy / doctor              | Implemented with tests                  |
| `apps/vscode-extension`      | VS Code extension                       | Beta; SecretStorage; scan commands      |
| `apps/worker`                | Thin worker package                     | Still delegates to API queue workers    |
| `packages/database`          | Drizzle + Postgres migrations 0000–0009 | PostgreSQL (not MySQL)                  |
| `packages/scanner-core`      | Deterministic rules                     | Fixtures + LIMITATIONS.md               |
| `packages/policy-engine`     | YAML policy parse/evaluate/lifecycle    | Unit tested                             |
| `packages/pricing-engine`    | Versioned pricing                       | Unit tested                             |
| `packages/agentguard-sdk`    | Node AgentGuard SDK                     | Unit + security contracts               |
| `packages/agentguard-python` | Python AgentGuard SDK                   | Package present; needs pip/pytest env   |
| `packages/mcp-security`      | MCP risk scan                           | Unit tested                             |
| `packages/compliance-engine` | Control catalog + reports               | Non-certification disclaimer            |
| `github-action/`             | GH Action scan                          | Beta                                    |
| `docker-compose.yml`         | postgres, redis, api, worker, web       | Infra healthy in local check            |
| `.github/workflows/ci.yml`   | Full release gate                       | No `continue-on-error` on critical jobs |

Legacy paths: `server.MOVED.md`, root `dist/` artifacts, marketing HTML decks — not the runtime source of truth.

---

## 2. Database technology

- **PostgreSQL** via Drizzle ORM (`packages/database`).
- Migrations: `0000` … `0009` (auth resource model, findings lifecycle).
- Redis for cache, rate limits, BullMQ, kill-switch hot path helpers.
- Backup scripts are **PostgreSQL** (`pg_dump` / `psql`).

---

## 3. Naming

- Product brand: **Rakshex** (`@rakshex/*` packages).
- Residual **DevPulse** strings remain in some UI copy, extension demos, and historical docs/pitch HTML. Runtime packages use Rakshex.

---

## 4. Auth & tenancy (code-backed)

| Control            | Location                                | Test coverage                               |
| ------------------ | --------------------------------------- | ------------------------------------------- |
| Argon2id passwords | `apps/api/utils/password.ts`            | `password.test.ts`, `auth.security.test.ts` |
| Session cookies    | tRPC context                            | security tests                              |
| OAuth PKCE         | `services/oauthPkce.ts`                 | unit tests                                  |
| Workspace RBAC     | `services/rbac.ts` + `authorization.ts` | rbac + authorization tests                  |
| API keys hashed    | `services/workspaceApiKeys.ts`          | workspaceApiKeys tests                      |
| Cross-tenant guard | `assertSameWorkspace`                   | tenantIsolation tests                       |

Client-supplied roles/workspace membership are **not** trusted — membership resolved from DB.

---

## 5. Scanner & findings

| Piece               | Status                                       |
| ------------------- | -------------------------------------------- |
| Secure import parse | `collectionImport/secureParse.ts` + tests    |
| Deterministic scan  | `@rakshex/scanner-core` rules + fixtures     |
| Scan worker         | `queues/workers/scanWorker.ts`               |
| Findings API        | `api/findings.ts` + tests                    |
| AI-only findings    | **Not** sole source; rules are deterministic |

---

## 6. AgentGuard / kill switch

| Piece                                 | Status                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| Node SDK privacy modes, offline queue | Implemented + tests                                              |
| Python SDK                            | Implemented (package)                                            |
| Gateway policy evaluate               | **Server loads kill switch from DB** (client flag ignored)       |
| Telemetry ingest                      | **Rejects with 403 when kill switch active**                     |
| Enforcement pure logic                | `services/gateway/enforcement.ts` + tests                        |
| Dashboard kill switch UI              | Exists; must not be the only control — **runtime paths enforce** |

---

## 7. Gaps / fragile areas (honest)

1. **Full end-to-end journey on staging** not fully automated with live OAuth/billing providers.
2. **Playwright e2e** depends on webServer boot of monorepo API + web — flaky until CI green confirmed.
3. **Billing** Stripe/Razorpay require live keys; memory abstraction tested.
4. **Legacy user-scoped kill switch** (userId) vs workspace-scoped multi-tenant ideal — works for single-tenant account model; multi-project agent switches are partial.
5. **VS Code / GitHub Action** still carry some DevPulse branding / demo modes.
6. **Web** uses untyped tRPC client in places for build pragmatism — type safety is package-level stronger than web app.
7. **Worker package** is thin; real workers live under `apps/api/queues`.

---

## 8. CI policy (actual)

- Critical jobs do **not** use `continue-on-error`.
- Stages include format, lint, typecheck, unit, integration, security, build, docker, migration, e2e, audit, secrets, SBOM, container scan.
- Release gate job requires all of the above.

---

## 9. What was false in older docs

- “Missing backend” — false; backend is `apps/api`.
- MySQL backup restore — fixed to PostgreSQL.
- Dockerfile `dist/server` entry — fixed to monorepo `apps/api` + tsx.
- Client-supplied `killSwitchActive` trusted by gateway — **fixed** in this audit pass.
- README ship-now viral package — replaced with maturity matrix.

---

**Next audit refresh:** after first full GH Actions green run and staging smoke of primary journey.
