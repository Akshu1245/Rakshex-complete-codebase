# Rakshex Rebuild Execution Plan

Source: `RAKSHEX COMPLETE CODEBASE REBUILD A.txt`  
Workspace: this repo (advanced DevPulse → Rakshex line, not the older zip alone)  
Strategy: **incremental monorepo**, not a big-bang rewrite

---

## Current state (honest gap map)

| Area                             | Status                | Notes                                                                                                               |
| -------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL + Redis               | **Mostly done**       | `docker-compose.yml` uses `rakshex-postgres` / `rakshex-redis`                                                      |
| Backend surface                  | **Strong**            | Large tRPC API under `server/api/*` (auth, scans, keys, kill-switch, control plane, GitHub, billing, compliance, …) |
| Frontend                         | **Working, misnamed** | Still `devpulse-frontend` package name                                                                              |
| VS Code extension                | **Partial**           | Still `devpulse-vscode`                                                                                             |
| GitHub Action                    | **Partial**           | `github-action/` exists                                                                                             |
| Scanner rules                    | **Heuristic / thin**  | Logic lives in `server/utils/scanning.ts` — not a versioned rule package                                            |
| Monorepo (`apps/` + `packages/`) | **Missing**           | Flat layout; no `pnpm-workspace` / Turbo yet                                                                        |
| Product naming                   | **Partial**           | Compose + vault key use Rakshex; root package still `devpulse`; DB URL defaults still `devpulse`                    |
| TypeScript strict                | **Off**               | Root `strict: false`                                                                                                |
| AgentGuard SDK packages          | **Partial**           | Services exist; no published `@rakshex/node` / Python SDK                                                           |
| CLI                              | **Missing**           | No `@rakshex/cli`                                                                                                   |
| Fake data ban                    | **Policy**            | Must gate demos; no placeholder findings in production paths                                                        |

---

## Phases

### Phase 0 — Foundation (this sprint) ✅ in progress

1. Execution plan (this doc)
2. `pnpm-workspace.yaml` + `packages/*` skeleton
3. `@rakshex/scanner-core` — typed rules, engine, tests
4. Wire scanner-core into `generateRealFindings` path
5. Product naming / script / env defaults (`rakshex`, Postgres not MySQL)

### Phase 1 — Monorepo shape (without breaking deploys)

- Soft map:
  - `server` → eventual `apps/api`
  - `devpulse-frontend` → `apps/web` (rename + package scope)
  - `devpulse-vscode` → `apps/vscode-extension`
  - `github-action` → keep or `apps/github-action`
- Add `tsconfig.base.json` (strict for **new** packages first)
- Keep existing entrypoints (`pnpm start`, Docker) working during the move

### Phase 2 — Scanner depth + findings lifecycle

- Expand rule catalog (API + AI/agent rules from rebuild Part A §10)
- Confidence / evidence / SARIF export
- Suppression, accepted risk, regression, baseline
- Safe sample collection for demos

### Phase 3 — Auth, tenancy, API keys hardening

- Roles matrix (Owner → Viewer + Billing Admin)
- Cross-workspace isolation tests
- `rk_live_` key prefix, hash-only storage, scopes, rotation

### Phase 4 — Runtime (AgentGuard)

- Extract `@rakshex/node` SDK
- Gateway + Redis kill-switch enforcement (not UI-only)
- Policy-as-code package (`@rakshex/policy-engine`)

### Phase 5 — Distribution

- CLI (`rakshex scan`, SARIF, exit codes)
- GitHub App + Action polish
- VS Code SecretStorage, diagnostics, quick fixes

### Phase 6 — Enterprise + compliance + billing polish

- Frameworks evidence model, audit hash-chain
- Stripe/Razorpay abstraction, GST
- Observability (`/health` `/ready` `/metrics`), retention, DPA

### Phase 7 — Market readiness

- Docs accuracy, security.txt, no unfinished pages
- E2E against real Postgres/Redis containers
- Launch checklist (Product Hunt, waitlist, pilots) — product + GTM

### Phase 8 — Part B differentiators + Part C gates

See **`docs/PART_B_C_GATES.md`** for the full matrix.

**Part B packages shipping in-repo:**

| Package                  | Differentiator                                     |
| ------------------------ | -------------------------------------------------- |
| `@rakshex/policy-engine` | Policy-as-code (YAML v1 + evaluate/simulate)       |
| `@rakshex/risk-baseline` | Risk baseline + regression + CI fail gate          |
| `@rakshex/agent-graph`   | Agent execution graph + run replay                 |
| `@rakshex/siem-export`   | Customer SIEM (CEF / syslog / Splunk HEC / ndjson) |
| `@rakshex/scanner-core`  | Deterministic scanner (Part C §9)                  |

**Part C runner:** `pnpm run release:gates`

Market-ready is **false** until every gate in Part C is green (automated + manual).

---

## Non-negotiables (from rebuild A)

- No fake data on authenticated production routes
- No hidden test failures
- No unimplemented routes advertised as live
- Tenant queries always workspace-authorized
- Costs labeled estimate vs confirmed
- Compliance assists; does not certify

---

## Definition of done for Phase 0

- [x] This plan checked in
- [x] `packages/scanner-core` builds and unit tests pass (7/7)
- [x] Scan path uses scanner-core for API findings (`server/utils/scanning.ts`)
- [x] Root scripts use Postgres (`db:up` → postgres redis)
- [x] Root package named `rakshex` (private monorepo root)
- [x] `.env.example` uses `rakshex` DB defaults
- [x] `pnpm-workspace.yaml` + `tsconfig.base.json` scaffolded
- [x] Frontend package renamed to `@rakshex/web` (folder still `devpulse-frontend`)
- [x] VS Code package renamed to `rakshex-vscode` (publisher `rakshex`)

---

## How to continue next session

```text
1. Finish Phase 0 verification (vitest packages/scanner-core + server scan tests)
2. Start Phase 1 rename: frontend package → @rakshex/web (folder rename last)
3. Add packages/policy-engine skeleton from server/engines/policyEngine.ts
4. Expand rule catalog one category at a time with tests per rule
```
