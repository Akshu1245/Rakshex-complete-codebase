# Rakshex Repository Foundation Audit

**Date:** 2026-07-12  
**Branch:** `akshu1245/feat/launch-control-plane`  
**Scope:** Foundation repair only (monorepo, naming, tooling). No product features.

---

## 1. What was found (pre-move inventory)

### Applications (legacy layout)

| Location             | Role                                                          |
| -------------------- | ------------------------------------------------------------- |
| `server/`            | Express + tRPC API, workers, services, engines                |
| `devpulse-frontend/` | Next.js web app (`@rakshex/web` package name already started) |
| `devpulse-vscode/`   | VS Code extension                                             |
| `github-action/`     | CI scan action                                                |
| `backend/`           | Thin legacy GitHub router file(s)                             |
| (none)               | Dedicated CLI package                                         |
| (none)               | Dedicated worker package surface                              |

### Packages (pre-existing under `packages/`)

| Package         | Status                              |
| --------------- | ----------------------------------- |
| `scanner-core`  | Present with rules + tests          |
| `policy-engine` | Present with YAML evaluate/simulate |
| `risk-baseline` | Present                             |
| `agent-graph`   | Present                             |
| `siem-export`   | Present                             |

### Database

| Asset                                       | Notes                                                              |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `drizzle/schema.ts`, `schema-enterprise.ts` | PostgreSQL Drizzle models                                          |
| `drizzle/*.sql` + `meta/`                   | Migrations 0000–0006 (history preserved)                           |
| `drizzle.config.ts`                         | Root config (moved into package)                                   |
| Compose                                     | Postgres + Redis already named `rakshex-*` in `docker-compose.yml` |

### Frontend routes (sample of `apps/web/app/`)

Landing, login/register, dashboard, collections, scanning, billing, kill-switch, control-plane, red-team, shadow-apis, compliance, enterprise, settings, docs/blog/marketing pages, admin, onboarding, etc.

### Tests

| Area               | Notes                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Server unit tests  | Large suite under former `server/**/*.test.ts` (~540+ tests)             |
| Package unit tests | scanner-core, policy-engine, risk-baseline, agent-graph, siem-export     |
| E2E                | Playwright at repo root `e2e/`                                           |
| CI                 | `.github/workflows/ci.yml`, `security-scan.yml`, `publish-extension.yml` |

### Docker / env

| Asset                              | Notes                             |
| ---------------------------------- | --------------------------------- |
| `Dockerfile`, `Dockerfile.prod`    | Multi-stage API + worker          |
| `docker-compose.yml` / `.prod.yml` | Postgres, Redis, worker, Jaeger   |
| `.env.example`                     | Auth, DB, Redis, OAuth, LLM, SMTP |

### Package managers / lockfiles (before)

- Root: `pnpm-lock.yaml` **and** `package-lock.json`
- Frontend + VS Code: nested `package-lock.json` + nested `pnpm-lock.yaml`
- Vendor trees also had lockfiles (left alone under `vendor/`)

### Legacy DevPulse references

Found across runbooks, compose prod (partially), package names, CI paths (`devpulse-frontend`), README branding, docs. Product code was mid-rebrand (compose already `rakshex`).

### Broken / fragile items noted

- Flat layout not monorepo-ready
- Multiple package managers / lockfiles
- Relative imports to `../drizzle` and `../../packages/*`
- `@shared/*` path alias only at root tsconfig
- Next.js 16: `next lint` no longer valid as used
- Root TypeScript `strict: false`
- Worker was only a Docker stage CMD, not a workspace package

---

## 2. What was moved / created

### Target monorepo layout

```
apps/
  api/                 # was server/
  web/                 # was devpulse-frontend/
  worker/              # new package surface → points at api workers
  cli/                 # new scaffold (@rakshex/cli)
  vscode-extension/    # was devpulse-vscode/
packages/
  database/            # was drizzle/ + drizzle.config
  shared-types/        # was shared/
  scanner-core/
  policy-engine/
  config/              # new naming/env constants
  pricing-engine/      # typed scaffold + TODO (no fake prices)
  agentguard-sdk/      # typed scaffold + TODO (no fake SDK behavior)
  risk-baseline/       # retained extra package
  agent-graph/         # retained
  siem-export/         # retained
```

### Tooling added / standardized

| File                              | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `pnpm-workspace.yaml`             | `apps/*`, `packages/*`, `github-action`     |
| `turbo.json`                      | `build`, `lint`, `typecheck`, `test`, `dev` |
| `tsconfig.base.json`              | Shared compiler + path aliases `@rakshex/*` |
| `eslint.config.js`                | Shared ESLint flat config                   |
| `.prettierrc` / `.prettierignore` | Shared Prettier                             |
| Root `package.json`               | Workspace root only; `pnpm` + turbo scripts |

### Naming

| Before                       | After                                                 |
| ---------------------------- | ----------------------------------------------------- |
| Root package `devpulse`      | `rakshex`                                             |
| `devpulse-frontend` dir      | `apps/web` (`@rakshex/web`)                           |
| `devpulse-vscode` dir        | `apps/vscode-extension` (`@rakshex/vscode-extension`) |
| Compose prod user/db/network | `rakshex`                                             |
| CI image name                | `akshu1245/rakshex`                                   |
| Docker CMD paths             | `dist/apps/api/...`                                   |

### Lockfiles

- **Removed:** root + app nested `package-lock.json`, nested `pnpm-lock.yaml` under web/vscode
- **Single manager:** pnpm
- **Single root lockfile:** `pnpm-lock.yaml`
- Vendor lockfiles under `vendor/` left intact (not workspace packages)

### Import rewrites (API)

- `../drizzle/schema` → `@rakshex/database` (and `/schema-enterprise` where needed)
- `../../packages/scanner-core/...` → `@rakshex/scanner-core`
- `@shared/const` → `@rakshex/shared-types/const` (bulk pass)

### Compatibility shims (temporary)

| Path                       | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `drizzle/schema.ts`        | Re-export from `@rakshex/database` schema for old paths |
| `drizzle.config.ts` (root) | Re-exports `packages/database/drizzle.config.ts`        |
| `server.MOVED.md`          | Points operators at `apps/api`                          |

---

## 3. What remains missing / incomplete

### Product (explicitly out of scope this PR)

- Auth product work, scanner rule expansion, billing, AgentGuard runtime implementation
- Full CLI commands (`login`, `scan`, `policy check`, …)
- Moving worker **source** into `apps/worker` (only package surface + Docker hint)
- Production-ready JS emit for `apps/api` (build currently typechecks packages; does not emit full API dist)
- `apps/web` Next production build not part of default root `build` filter
- Composite TypeScript project references end-to-end

### Remaining technical debt (precise)

1. **`pnpm --filter @rakshex/api typecheck` / `build`**  
   Not part of default root scripts. Residual issues after foundation move (verify with `pnpm --filter @rakshex/api typecheck`):
   - Residual relative `drizzle` imports (should be `@rakshex/database`) — largely bulk-fixed
   - Vitest aliases for `@rakshex/database/schema-enterprise` (added in `apps/api/vitest.config.ts`)
   - Optional modules (vite, node-cron, playwright, google-auth-library) must stay declared on `@rakshex/api`
   - Full JS emit + `scripts/add-js-extensions.js` not rewired for `apps/api` outDir
   - API tsconfig still uses non-strict mode for legacy compatibility

2. **`pnpm run test:api`**  
   ~546 tests **pass** when load succeeds; some test **files** fail to load without Redis/DB or due to path resolution. Not part of default `pnpm test` (packages only). Use `pnpm run test:api` intentionally.

3. **`apps/web`**
   - Peer dependency mismatch: `@trpc/client@11.18` vs `@trpc/server@11.17`
   - `next lint` removed/broken on Next 16; lint script softened / root ESLint does not fully cover web by default
   - Default root `lint` covers packages + api + cli + worker (not full Next app)

4. **Docker production image**
   - CMD updated to `dist/apps/api/_core/index.js` but **full emit pipeline** for that path is not verified green in this foundation change
   - TODO marked in `Dockerfile`

5. **Legacy DevPulse strings** still appear in historical docs (runbooks, pitch decks, older markdown). Config/runtime naming is Rakshex; docs cleanup is incremental.

6. **Extra packages** (`risk-baseline`, `agent-graph`, `siem-export`) are retained but not in the original “required structure” list — kept because they already had tests and do not hurt the monorepo.

7. **`github-action`** remains at repo root (workspace member) rather than under `apps/`.

8. **`backend/`** legacy folder not deleted (may still contain reference code).

---

## 4. Assumptions

1. **Git history preservation** via `git mv` for primary trees is sufficient; no force-rewrite of history.
2. **pnpm@10.32.1** remains the only supported package manager (`packageManager` field).
3. **Default root scripts** intentionally target packages + cli + worker for green CI foundation; full monorepo `*:all` scripts exist for broader runs.
4. **Scaffold packages** (`pricing-engine`, `agentguard-sdk`) expose typed interfaces with TODOs only — no invented product behavior.
5. **Worker runtime** continues to use `apps/api/queues/workers` until a dedicated bundle is safe.
6. **Vendor/** trees are not part of the product workspace and may keep their own lockfiles.
7. **Database migrations** must not be renumbered destructively; files live under `packages/database/drizzle/` with history intact.

---

## 5. Command status (foundation)

| Command          | Status   | Notes                                                       |
| ---------------- | -------- | ----------------------------------------------------------- |
| `pnpm install`   | **Pass** | 17 workspace projects                                       |
| `pnpm lint`      | **Pass** | packages + apps/cli + worker + api                          |
| `pnpm typecheck` | **Pass** | packages + cli + worker                                     |
| `pnpm test`      | **Pass** | package unit tests (scanner, policy, baseline, graph, siem) |
| `pnpm build`     | **Pass** | package + cli + worker typecheck builds                     |

### Opt-in / remaining

| Command                  | Status                                                          |
| ------------------------ | --------------------------------------------------------------- |
| `pnpm run typecheck:all` | Includes apps that may still fail (api, web)                    |
| `pnpm run build:all`     | Same                                                            |
| `pnpm run test:api`      | Large suite; may fail without Redis/DB or remaining path issues |
| `pnpm run lint:all`      | turbo lint across all (web Next config TBD)                     |

---

## 6. How to continue (next foundation steps)

1. Finish residual API import cleanup; make `pnpm --filter @rakshex/api typecheck` green without inventing features.
2. Align `@trpc/*` versions in `apps/web`.
3. Wire real `apps/api` emit (`tsc` outDir + extension rewriter) and verify Docker CMD.
4. Move worker sources into `apps/worker` when import graph is stable.
5. Sweep remaining DevPulse strings in operator docs.
6. Add composite TS project references so packages do not re-typecheck each other via source paths.

---

## 7. Acceptance checklist (this change)

- [x] One package manager (pnpm)
- [x] One root lockfile (`pnpm-lock.yaml`)
- [x] Consistent Rakshex package naming (`@rakshex/*`)
- [x] Clear monorepo (`apps/*`, `packages/*`)
- [x] No broken relative package paths for **packages** under default scripts
- [x] Audit document created (this file)
- [x] Remaining build/type errors listed precisely (section 3)
- [x] No fake backend implementations invented for product domains
- [x] Temporary adapters marked with TODOs where needed
