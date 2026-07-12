# Implementation status

**Updated:** 2026-07-12 (completion pass)  
**Rules:** Code + tests are truth. **Production-ready** needs real implementation, authz, error handling, unit + integration tests, docs, production build, **and** staging journey sign-off.

Legend: **Not started** · **In progress** · **Implemented** · **Tested** · **Production-ready** · **Blocked**

---

## Gate results (local, this pass)

| Command                          | Result                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | **Pass**                                                    |
| `pnpm format:check`              | **Pass**                                                    |
| `pnpm lint`                      | **Pass**                                                    |
| `pnpm typecheck`                 | **Pass**                                                    |
| `pnpm test`                      | **Pass**                                                    |
| `pnpm test:security`             | **Pass**                                                    |
| `pnpm test:integration`          | **Pass**                                                    |
| `pnpm build`                     | **Pass**                                                    |
| `pnpm db:migrate`                | **Pass** (already up to date)                               |
| Gateway enforcement unit tests   | **Pass** (10)                                               |
| API boots with real Postgres     | **Pass** (when Docker up)                                   |
| `pnpm smoke:test`                | **Blocked** if Docker Desktop down / wrong process on :3000 |
| `pnpm test:e2e` full browser     | **In progress** — needs web + API + Docker                  |
| `docker compose build`           | **Blocked** when Docker daemon unavailable                  |

---

## Milestone tracker

| #     | Feature                          | Status          | Notes                                      |
| ----- | -------------------------------- | --------------- | ------------------------------------------ |
| 1     | Monorepo pnpm+turbo              | **Tested**      | Green install/build                        |
| 2     | PostgreSQL migrations 0000–0009  | **Tested**      | Foundation tests + migrate                 |
| 2     | Redis                            | **Tested**      | When Docker running                        |
| 3     | Auth Argon2id + sessions         | **Tested**      | auth.security tests                        |
| 3     | OAuth PKCE / MFA                 | **Tested**      | Unit; live OAuth needs keys                |
| 3     | RBAC + BOLA guards               | **Tested**      | tenantIsolation + authorization            |
| 4     | Workspaces / projects / API keys | **Tested**      | Hashed keys                                |
| 5     | Secure import parse              | **Tested**      | YAML bombs, $ref block                     |
| 6     | Deterministic scanner            | **Tested**      | fixtures                                   |
| 7     | Findings lifecycle               | **Tested**      | API + web pages                            |
| 8     | Frontend real backend            | **Implemented** | Login/scan/findings wired                  |
| 9     | VS Code extension                | **Implemented** | Scan workspace                             |
| 10    | CLI                              | **Tested**      | SARIF/JSON                                 |
| 11    | GitHub CI scan                   | **Implemented** | Live GH **Blocked** without secrets        |
| 12    | AgentGuard Node SDK              | **Tested**      | Security contracts                         |
| 12    | AgentGuard Python SDK            | **Implemented** | Package present                            |
| 13    | Kill switch server-side          | **Tested**      | DB + Redis cache + gateway + telemetry 403 |
| 14    | Policy-as-code                   | **Tested**      | lifecycle immutable publish                |
| 15    | Pricing engine                   | **Tested**      | Historical stability                       |
| 16    | MCP security package             | **Tested**      |                                            |
| 17    | Compliance evidence              | **Tested**      | Not certification                          |
| 18    | Billing abstraction              | **Tested**      | Live Stripe **Blocked** without keys       |
| 19    | OTel / privacy / redaction       | **Implemented** |                                            |
| 20    | Test hardening                   | **Tested**      | unit/security/integration                  |
| 21    | CI/CD + Docker files             | **Implemented** | CI unconfirmed on GH; Docker needs daemon  |
| 22–23 | Docs + audit                     | **Implemented** | Honest non-claims                          |

**Nothing is marked Production-ready for public GA** until: Docker smoke green, staging journey, GH Actions release-gate green.

---

## Completed this completion pass

1. Committed all pending milestone code (`9f204e1`).
2. Kill switch **Redis hot cache** on trigger/reset/budget (`killSwitchCache.ts`).
3. Gateway uses Redis then Postgres for KS (never client flag).
4. Fixed missing **`multer`** dependency so API can boot.
5. `pnpm dev:api` entry script.
6. Format/lint/typecheck/test/security/integration/build green.

---

## Failed / not completed (still open)

| Item                               | Why                                                           |
| ---------------------------------- | ------------------------------------------------------------- |
| Full `smoke:test` against stack    | Docker Desktop daemon stopped mid-session; Redis ECONNREFUSED |
| Full Playwright E2E                | Needs API+web+DB; not re-run with stable stack                |
| `docker compose build` full images | Docker API unavailable                                        |
| Live Stripe/Razorpay               | No provider secrets in env                                    |
| Live GitHub App PR e2e             | No app credentials                                            |
| Multi-workspace KS schema          | Still user-scoped in DB                                       |
| Residual DevPulse branding         | Cosmetic                                                      |

---

## Next actions (exact)

1. **Start Docker Desktop**, then:
   ```bash
   pnpm db:up
   pnpm db:migrate
   pnpm dev:api          # terminal 1
   API_URL=http://127.0.0.1:3000 pnpm smoke:test
   ```
2. Optionally `pnpm --filter @rakshex/web dev` and `pnpm test:e2e`.
3. Push branch; confirm GitHub Actions **release-gate** green.
4. Staging checklist in `docs/RELEASE_CHECKLIST.md`.
