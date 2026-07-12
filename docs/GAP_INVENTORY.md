# Gap inventory — half-done, pending, unbuilt, failures

**Updated:** 2026-07-12  
**Product status:** Launch-candidate (core). **Not** unconditional public GA.

---

## 1. Done and proven (when stack is up)

| Item                                                                     | Evidence                        |
| ------------------------------------------------------------------------ | ------------------------------- |
| Monorepo, migrations 0000–0009                                           | `pnpm db:migrate`               |
| Auth Argon2id / RBAC / hashed API keys                                   | unit + security tests           |
| Import + scanner + findings                                              | package + API tests             |
| AgentGuard Node SDK                                                      | vitest                          |
| AgentGuard Python SDK                                                    | **pytest 6 passed** (this pass) |
| Policy / pricing / MCP / compliance engines                              | package tests                   |
| Kill switch server-side + Redis cache                                    | enforcement + cache tests       |
| Local gates: format, lint, typecheck, unit, security, integration, build | green previously                |
| Live smoke (db/redis/queue)                                              | green when Docker + API up      |

---

## 2. Half-done / pending / unbuilt

### Important (blocks honest “GA”)

| #   | Gap                                                                                  | Owner                                         |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| A   | Remote GitHub Actions **release-gate** not confirmed green                           | **You** (push + watch CI)                     |
| B   | Staging human journey not signed (`docs/RELEASE_CHECKLIST.md`)                       | **You**                                       |
| C   | Production secrets (JWT, DB, Redis, SMTP, optional Stripe/GH)                        | **You**                                       |
| D   | Docker Desktop daemon often down → full `docker compose build` / image not re-proven | **You** start Docker; agent can rebuild after |

### Product / feature gaps (code incomplete or shallow)

| #   | Gap                                                                                | Status                         | Owner                                                      |
| --- | ---------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| E   | Full Playwright UI e2e (`pnpm test:e2e`) not re-run with web on :3001              | Half                           | You + agent when stack up                                  |
| F   | Kill switch scoped **per user**, not multi-workspace (schema `userId` unique only) | Half                           | Agent can design migration later; larger change            |
| G   | Live Stripe / Razorpay billing                                                     | Abstraction only               | You (keys)                                                 |
| H   | Live GitHub App PR scans                                                           | Implemented; needs App secrets | You                                                        |
| I   | VS Code extension polish / residual demo paths                                     | Implemented beta               | Optional                                                   |
| J   | Residual **DevPulse** strings in UI package names, historical docs, some emails    | Partial                        | Agent fixed runtime API export/PR/email defaults this pass |
| K   | Worker sources still partially in API tree (`TODO(foundation)` in apps/worker)     | Half                           | Later refactor                                             |
| L   | OTel / privacy “Implemented” not full prod exporter proof                          | Half                           | Staging                                                    |

---

## 3. Errors and failures faced (session history)

| Failure                                     | Cause                      | Resolution                                              |
| ------------------------------------------- | -------------------------- | ------------------------------------------------------- |
| Docker `npipe ... dockerDesktopLinuxEngine` | Docker Desktop not running | **You:** start Docker Desktop until `docker info` works |
| Redis `ECONNREFUSED`                        | Redis container down       | `pnpm db:up` when Docker up                             |
| Wrong process on `:3000` / smoke timeout    | Stale or dead API          | Restart `pnpm dev:api`                                  |
| Alpine `adduser` failed                     | Wrong flags for Alpine     | Fixed (`adduser -S -G`)                                 |
| Multer missing                              | Dep not in package         | Fixed                                                   |
| Docker build context huge / EOF             | Large context              | Fixed `.dockerignore`                                   |
| Default python = Hermes venv without pip    | PATH order                 | Use `py -3` for pytest                                  |
| Client-trusted `killSwitchActive`           | Security hole              | Fixed server DB+Redis                                   |

---

## 4. What the agent fixed this pass

- Runtime branding: audit/compliance filenames + PDF, PR scan comments, payments/reports URLs, email defaults → **Rakshex**
- `killSwitchCache.test.ts` unit tests
- Python AgentGuard: **6 tests passed** via `py -3 -m pytest`

---

## 5. What only you can fix

1. **Start Docker Desktop** → `docker info` succeeds.
2. **`git push`** branch → confirm Actions release-gate green.
3. **Staging:** signup → workspace → import → scan → findings → kill switch.
4. **Prod secrets** on host (never commit).
5. Optional: Stripe / Razorpay / GitHub App credentials if you sell those paths.

---

## 6. Honest recommendation

Ship **private beta / waitlist** now if A–C are accepted as operator follow-up.  
Do **not** claim unconditional public GA, SOC2/ISO certification, or “fully enterprise ready for all regulated buyers” until A–C are done.
