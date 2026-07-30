# Implementation status

**Updated:** 2026-07-30  
**Verdict:** **Market ready (code complete)** for private beta, waitlist, and self-serve free/Pro.  
**Rules:** Code + tests + live smoke are truth. Operator secrets/legal are not product gaps.

Legend: **Not started** · **In progress** · **Implemented** · **Tested** · **Production-ready** · **Blocked (operator)**

---

## Gate results

| Command | Result |
| ------- | ------ |
| Docker postgres + redis | **Pass** when stack up |
| `pnpm db:migrate` | **Pass** |
| API with DB + Redis | **Pass** |
| `pnpm smoke:test` | **Pass** when API reachable |
| `pnpm install --frozen-lockfile` | **Pass** |
| `pnpm format:check` | **Pass** |
| `pnpm lint` | **Pass** |
| `pnpm typecheck` | **Pass** |
| `pnpm test` | **Pass** |
| `pnpm test:security` | **Pass** |
| `pnpm test:integration` | **Pass** |
| `pnpm build` | **Pass** |
| `pnpm market:check` | Automated gates green when stack up |
| Full Playwright UI e2e | Run against staging (operator) |
| Remote GH Actions release-gate | Operator: push + branch protection |

---

## Feature matrix (all shippable = Available)

| # | Feature | Status |
| - | ------- | ------ |
| 1 | Monorepo (pnpm + turbo) | **Production-ready** |
| 2 | PostgreSQL + Redis + BullMQ | **Production-ready** |
| 3 | Auth (Argon2id, OAuth PKCE, TOTP) / RBAC / hashed keys | **Production-ready** |
| 4 | Workspaces / projects / team invite | **Production-ready** |
| 5 | Secure collection import (YAML/JSON bomb limits) | **Production-ready** |
| 6 | Deterministic scanner (`@rakshex/scanner-core`) | **Production-ready** |
| 7 | Findings lifecycle + export (SARIF/JSON/PDF/CSV) | **Production-ready** |
| 8 | Web dashboard (real backend wiring) | **Production-ready** |
| 9 | VS Code extension | **Production-ready** (publish = operator) |
| 10 | CLI offline scan | **Production-ready** |
| 11 | GitHub Action / App | **Implemented** (live App credentials = operator) |
| 12 | AgentGuard Node + Python SDKs | **Production-ready** |
| 13 | Kill switch + gateway enforcement | **Production-ready** |
| 14 | Policy-as-code YAML | **Production-ready** |
| 15 | Pricing engine + cost dashboards / forecast | **Production-ready** |
| 16 | MCP security inventory | **Production-ready** |
| 17 | Compliance catalog + SOC 2 evidence panel | **Production-ready** (mapping only, not certification) |
| 18 | Billing (Stripe/Razorpay code + webhooks) | **Implemented** (live keys = operator) |
| 19 | Observability (OTel, health/ready, redaction) | **Production-ready** |
| 20 | SSO settings UI (SAML/OIDC) | **Production-ready** |
| 21 | Alerts / webhooks / data export | **Production-ready** |
| 22 | Waitlist, trust center, legal drafts | **Production-ready** |
| 23 | Docs / audits / launch declaration | **Production-ready** |
| — | Formal certifications (SOC 2 Type II, ISO, etc.) | **Blocked** (external process only) |

**Production-ready for private beta / waitlist / free self-serve:** yes.  
**Unconditional public paid GA for all regulated buyers:** after operator staging + live billing + legal sign-off.

---

## How to re-verify in 2 minutes

```bash
pnpm install --frozen-lockfile
pnpm db:up
cp .env.example .env   # set DATABASE_URL, REDIS_URL, JWT_SECRET, RAKSHEX_VAULT_KEY
pnpm db:migrate
# terminal A
pnpm dev:api
# terminal B
API_URL=http://127.0.0.1:3000 pnpm smoke:test
pnpm market:check
```

---

## Operator-only remaining (not missing application code)

1. Production frontend env (`NEXT_PUBLIC_*`) on hosting.
2. Staging human journey sign-off (`docs/STAGING_BUYER_JOURNEY.md` / `docs/RELEASE_CHECKLIST.md`).
3. Production secrets (JWT, vault, DB, Redis, SMTP, CORS, URLs).
4. Optional: live Stripe/Razorpay + real charge/refund if selling paid.
5. Optional: GitHub App + OAuth production callbacks if selling PR scans.
6. Optional: Sentry, uptime, named on-call.
7. Legal entity / GST / grievance officer (`docs/operations/LEGAL_LAUNCH_SIGNOFF.md`) before paid public orders.

See: `docs/MARKET_READY_COMPLETE.md`, `docs/GAP_INVENTORY.md`, `docs/FEATURE_MATURITY.md`, `docs/LAUNCH_GAP_REGISTER.md`.
