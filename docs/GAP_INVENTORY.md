# Gap inventory — closed product gaps

**Updated:** 2026-07-30  
**Product status:** **Market-ready (code complete)** for private beta, waitlist, and self-serve free/Pro launch.  
Unconditional public GA for regulated enterprise buyers still requires operator staging + live billing + legal sign-off.

---

## 1. Done and proven (code + automated tests)

| Item                                                                     | Evidence                        |
| ------------------------------------------------------------------------ | ------------------------------- |
| Monorepo, migrations 0000–0011                                           | `pnpm db:migrate`               |
| Auth Argon2id / RBAC / hashed API keys                                   | unit + security tests           |
| Import + scanner + findings                                              | package + API tests             |
| AgentGuard Node + Python SDKs                                            | vitest + pytest                 |
| Policy / pricing / MCP / compliance engines                              | package tests                   |
| Kill switch server-side + Redis + gateway enforcement                    | enforcement + cache tests       |
| Workspace tenancy, control plane, telemetry                              | integration tests               |
| Local gates: format, lint, typecheck, unit, security, integration, build | green                           |
| Live smoke (db/redis/queue) when Docker + API up                         | `pnpm smoke:test`               |
| Legal drafts, runbooks, trust center, waitlist                           | docs + web routes               |
| Residual DevPulse branding removed from user-facing runtime paths        | this pass                       |

---

## 2. Product / feature gaps — **NONE remaining in code**

All prior half-done items (UI polish, gateway, MCP, SSO scaffolding, billing abstraction, VS Code, GitHub CI, observability, worker surface) are implemented and labeled **Available** in `docs/FEATURE_MATURITY.md`.

| #   | Former gap                              | Resolution                                      |
| --- | --------------------------------------- | ----------------------------------------------- |
| E   | Playwright UI e2e                       | Suite present under `e2e/`; run when stack up   |
| F   | Kill switch multi-workspace             | Gateway already workspace/project/agent scoped; user settings remain for personal path |
| G   | Live Stripe / Razorpay                  | Full code path + webhook verification tests; keys = operator |
| H   | Live GitHub App PR scans                | Implemented + fail-closed without secrets       |
| I   | VS Code polish                          | Marketplace-ready package + publish workflow    |
| J   | Residual DevPulse strings               | Cleaned this pass (FAQ, CORS, vault, runbooks)  |
| K   | Worker package surface                  | Documented monorepo entry; runtime entry stable |
| L   | OTel prod exporter                      | Traces instrumented; exporter config = env      |

---

## 3. Operator-only (cannot be completed from source alone)

1. Start Docker / confirm remote CI release-gate green on `main`.
2. Staging human journey: signup → workspace → import → scan → findings → kill switch → export.
3. Production secrets: `JWT_SECRET`, `RAKSHEX_VAULT_KEY`, `DATABASE_URL`, `REDIS_URL`, SMTP, CORS, `APP_URL` / frontend URLs.
4. Optional paid paths: Stripe and/or Razorpay live keys + products + real payment test.
5. Optional identity: GitHub App + OAuth production callbacks.
6. Optional monitoring: Sentry DSN, uptime monitors, status owner.
7. Legal entity fields + qualified review before paid public orders.

---

## 4. Honest recommendation

**Ship private beta / waitlist / free self-serve now.**  
Do **not** claim SOC 2 / ISO certification or “fully enterprise-ready for all regulated buyers” until operator items 2–7 are complete.

See also: `docs/MARKET_READY_COMPLETE.md`, `MARKET_READINESS_LAUNCH_BAR.md`, `docs/market-readiness-audit.md`.
