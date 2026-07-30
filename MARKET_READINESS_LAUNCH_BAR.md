# Rakshex Market Readiness Launch Bar

> Non-negotiable pass criteria for mixed launch (enterprise pilot + self-serve).
> **Code Critical items: PASS as of 2026-07-30.** Operator / live-provider items remain for public paid GA.

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

## Critical (Must Pass Before Pilot) — CODE COMPLETE

### Security & Tenancy

- [x] All enterprise API procedures verify workspace membership via `assertWorkspacePermission`
- [x] Cross-tenant access negative tests pass
- [x] API keys stored hashed-at-rest; plaintext keys shown only once at creation
- [x] Enterprise Azure credentials encrypted at write-time via vault
- [x] GitHub webhook verification fails closed when secret missing in production
- [x] GitHub App fails closed without credentials in production
- [x] Import / collection access does not accept cross-user IDOR

### Release Integrity

- [x] CI typecheck fails the build on error (no `|| true`)
- [x] CI lint required on every PR
- [x] Smoke E2E suite present (`e2e/`); **ops:** mark required in branch protection
- [x] Frontend build config does not ignore TS/ESLint by default — **ops:** confirm branch protection on main

### Deploy & Setup

- [x] `.env.example` at repo root matches critical vars
- [x] `GETTING_STARTED.md` references working env template
- [x] `docker-compose.prod.yml` requires production Redis/SMTP/metrics/GitHub webhook secrets
- [ ] Clean-machine setup under 15 minutes — **ops:** time a fresh laptop run

### Billing

- [x] Webhook signature verification tests (reject missing/invalid, accept valid)
- [x] Checkout code paths for Stripe + Razorpay present with tests
- [ ] Live dashboard amount match — **ops** after keys configured

### Launch-gate automation

- [x] CORS allowlist explicit (no wildcards); residual legacy origin removed 2026-07-30
- [x] Redis required in production
- [x] No demo-data on DB failure
- [x] Email fail-closed in production without SMTP
- [x] Data export prepare/download one-time token path

---

## High (Should Pass Before Broad Launch)

- [x] Migration journal through `0011_p3_hot_path_indexes`
- [x] Public routes protected via middleware
- [x] GitHub dashboard fail-closed without App credentials
- [x] Brand naming normalized on user-facing runtime (Rakshex) — this pass
- [ ] Sentry replay / Crisp consent — **ops/config**
- [ ] Security events retention job confirmed in staging — **ops**
- [ ] Runbooks practiced with named on-call — **ops**

---

## Pilot Go/No-Go Gate

| Check                            | Code | Operator |
| -------------------------------- | ---- | -------- |
| All Critical code items green    | ✅   |          |
| Zero tenant-isolation bypasses   | ✅   | Staging probe |
| Billing regression suite green   | ✅   | Live key test |
| Staging deploy from clean env    |      | ☐        |
| Core smoke E2E passing           | ✅ suite | Run on staging |
| Enterprise demo script validated | ✅   | ☐        |

**Code go for private beta: YES.**  
**Public paid GA go:** after operator column completed.

See: [docs/MARKET_READY_COMPLETE.md](docs/MARKET_READY_COMPLETE.md), [docs/STAGING_BUYER_JOURNEY.md](docs/STAGING_BUYER_JOURNEY.md).
