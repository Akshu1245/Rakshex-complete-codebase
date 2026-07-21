# DevPulse / RakshEx Market Readiness Launch Bar

> Non-negotiable pass criteria for mixed launch (enterprise pilot + self-serve).
> Review twice weekly until all Critical items are green.
> Checkmarks below reflect **code/tests in this repo** as of the P4 launch-gate pass —
> operator, CI branch-protection, and live-provider items stay unchecked until verified outside the codebase.

## Owners

| Area                      | Owner           | Backup        |
| ------------------------- | --------------- | ------------- |
| Backend / AuthZ / Secrets | Backend Lead    | Platform      |
| Frontend / UX / Privacy   | Frontend Lead   | Product       |
| CI/CD / Deploy / Infra    | Platform/DevOps | Backend Lead  |
| Billing / Payments        | Backend Lead    | Finance Ops   |
| Compliance / Runbooks     | Security Lead   | Backend Lead  |
| GTM / Brand / Docs        | Product/GTM     | Frontend Lead |

---

## Critical (Must Pass Before Pilot)

### Security & Tenancy

- [x] All enterprise API procedures verify workspace membership via `assertWorkspacePermission` _(code: `api/enterprise/workspaceAuth.ts` + tests)_
- [x] Cross-tenant access negative tests pass (user A cannot access user B workspace) _(code: `services/tenantAccess.test.ts`)_
- [x] API keys stored hashed-at-rest; plaintext keys shown only once at creation _(code: `services/workspaceApiKeys.ts`)_
- [x] Enterprise Azure credentials encrypted at write-time via vault _(code: `api/enterprise/azureConnections.ts` + `encryptedVault`)_
- [x] GitHub webhook verification fails closed when `GITHUB_WEBHOOK_SECRET` is missing in production _(code + `api/githubCiScan.test.ts`)_
- [x] GitHub App fails closed without credentials in production _(no mock clients/repos; `services/githubApp.failClosed.test.ts`)_
- [x] Import / collection access does not accept cross-user IDOR _(tenantAccess + collection helpers)_

**Pass criteria:** AuthZ test suite green; manual cross-tenant probe returns 403.  
**Operator note:** Still run a staging cross-tenant probe before pilot go.

### Release Integrity

- [x] CI typecheck (`pnpm run typecheck` / `pnpm run check`) fails the build on error (no `|| true`) _(`.github/workflows/ci.yml`)_
- [x] CI lint required on every PR _(lint job in `ci.yml`)_
- [ ] Smoke E2E suite required (login redirect, health, billing pages load) — **ops:** confirm job is required in branch protection
- [ ] Frontend build does not ignore TypeScript or ESLint errors — **ops:** confirm Next.js config + branch protection; do not claim until verified on main

**Pass criteria:** Red PR cannot merge; main branch always green. _(Branch protection is external.)_

### Deploy & Setup

- [x] `.env.example` exists at repo root and matches critical vars from `apps/api/_core/env.ts` (REDIS_URL, SMTP_*, METRICS_TOKEN, CORS_ORIGINS, GITHUB_WEBHOOK_SECRET, GITHUB_APP_SLUG, …)
- [x] `GETTING_STARTED.md` references working env template (`.env.example`)
- [x] `docker-compose.prod.yml` requires production Redis/SMTP/metrics/GitHub webhook secrets
- [ ] Clean-machine setup completes in under 15 minutes following docs — **ops:** time a fresh laptop run; not automated

**Pass criteria:** New engineer boots app from docs without Slack help. _(15-min drill is external.)_

### Billing

- [ ] Payment amounts stored consistently in INR (major units), not mixed paise/INR — **code still documents Razorpay amounts in paise in places; do not check until reconciled**
- [x] Webhook signature verification tests complete (reject missing/invalid, accept valid) _(Stripe/Razorpay test coverage present)_
- [ ] One-time payment verify path divides Razorpay paise by 100 — **ops/code review:** confirm every verify path before checking

**Pass criteria:** Payment regression tests green; invoice amounts match Razorpay dashboard. _(Live dashboard match is external.)_

### Launch-gate automation (P4)

- [x] CORS allowlist is explicit (no `*.vercel.app` / `*.insforge` wildcards) — `_core/corsAllowlist.test.ts`
- [x] Redis required in production (cache + queues) — `_core/redisRequired.prod.test.ts`
- [x] No demo-data on DB failure — `db.security.test.ts`
- [x] Email fail-closed in production without SMTP — `email.failClosed.test.ts`
- [x] Data export prepare/download metadata one-time token path — `api/dataExport.prepare.test.ts`

---

## High (Should Pass Before Broad Launch)

### Data Integrity

- [x] Migration journal includes SQL through `0011_p3_hot_path_indexes` (aligned with `packages/database/src/migrate.ts` MIGRATION_ORDER)
- [ ] Critical multi-step writes use transactions (workspace create, scan + findings) — **partial;** verify remaining hot paths before checking

### Frontend Trust

- [x] Public routes protected via middleware (not brittle client allowlist) _(apps/web/middleware.ts + `publicRoutes`)_
- [ ] Sentry replay masks text/media; Crisp gated behind consent — **ops/config**
- [ ] No placeholder links (`/support`, generic GitHub/Discord URLs) in production nav — **ops:** spot-check production build
- [x] GitHub dashboard does not expose mock install IDs in production _(fail-closed without App credentials)_

### Compliance Evidence

- [ ] Security events flush durably to DB with retention policy — **partial code; ops must confirm retention job in staging**
- [ ] Runbooks published: incident response, billing, on-call — **docs/ops external**
- [ ] Audit log export available for enterprise pilot — **confirm with pilot buyer**

---

## Nice-to-Have (Post-Pilot)

- [ ] Product funnel analytics (landing CTA, signup, first scan, checkout)
- [ ] Automated sitemap generation from route inventory
- [ ] Full Playwright journey suite (landing → auth → first value → billing)
- [ ] Brand naming normalized across all surfaces (RakshEx / DevPulse canonical)

---

## Pilot Go/No-Go Gate (End of Week 6)

| Check                            | Status | Verified By | Date |
| -------------------------------- | ------ | ----------- | ---- |
| All Critical items green         | ☐      |             |      |
| Zero tenant-isolation bypasses   | ☐      |             |      |
| Billing regression suite green   | ☐      |             |      |
| Staging deploy from clean env    | ☐      |             |      |
| Core smoke E2E passing           | ☐      |             |      |
| Enterprise demo script validated | ☐      |             |      |

**Go decision requires all Critical + Pilot Gate rows checked.**  
See also: [docs/STAGING_BUYER_JOURNEY.md](docs/STAGING_BUYER_JOURNEY.md).

---

## Weekly Review Template

```
Week: ___
Critical blockers open: ___
High items open: ___
Decisions needed: ___
Next week focus: ___
```
