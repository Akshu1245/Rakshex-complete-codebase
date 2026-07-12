# DevPulse Market Readiness Launch Bar

> Non-negotiable pass criteria for mixed launch (enterprise pilot + self-serve).
> Review twice weekly until all Critical items are green.

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

- [ ] All enterprise API procedures verify workspace membership via `assertWorkspacePermission`
- [ ] Cross-tenant access negative tests pass (user A cannot access user B workspace)
- [ ] API keys stored hashed-at-rest; plaintext keys shown only once at creation
- [ ] Enterprise Azure credentials encrypted at write-time via vault
- [ ] GitHub webhook verification fails closed when `GITHUB_WEBHOOK_SECRET` is missing in production
- [ ] Import endpoints do not accept unauthenticated or cross-user IDOR queries

**Pass criteria:** AuthZ test suite green; manual cross-tenant probe returns 403.

### Release Integrity

- [ ] CI typecheck (`pnpm run check`) fails the build on error (no `|| true`)
- [ ] CI lint required on every PR
- [ ] Smoke E2E suite required (login redirect, health, billing pages load)
- [ ] Frontend build does not ignore TypeScript or ESLint errors

**Pass criteria:** Red PR cannot merge; main branch always green.

### Deploy & Setup

- [ ] `.env.example` exists and matches `server/_core/env.ts` required vars
- [ ] `GETTING_STARTED.md` and `scripts/setup.sh` reference working env template
- [ ] `docker-compose.prod.yml` uses `devpulse-frontend` and correct server entrypoint
- [ ] Clean-machine setup completes in under 15 minutes following docs

**Pass criteria:** New engineer boots app from docs without Slack help.

### Billing

- [ ] Payment amounts stored consistently in INR (major units), not mixed paise/INR
- [ ] Webhook signature verification tests complete (reject missing/invalid, accept valid)
- [ ] One-time payment verify path divides Razorpay paise by 100

**Pass criteria:** Payment regression tests green; invoice amounts match Razorpay dashboard.

---

## High (Should Pass Before Broad Launch)

### Data Integrity

- [ ] Migration journal includes all SQL files (0002, 0003 reconciled)
- [ ] Critical multi-step writes use transactions (workspace create, scan + findings)

### Frontend Trust

- [ ] Public routes protected via middleware (not brittle client allowlist)
- [ ] Sentry replay masks text/media; Crisp gated behind consent
- [ ] No placeholder links (`/support`, generic GitHub/Discord URLs) in production nav
- [ ] GitHub dashboard does not expose mock install IDs in production

### Compliance Evidence

- [ ] Security events flush durably to DB with retention policy
- [ ] Runbooks published: incident response, billing, on-call
- [ ] Audit log export available for enterprise pilot

---

## Nice-to-Have (Post-Pilot)

- [ ] Product funnel analytics (landing CTA, signup, first scan, checkout)
- [ ] Automated sitemap generation from route inventory
- [ ] Full Playwright journey suite (landing → auth → first value → billing)
- [ ] Brand naming normalized across all surfaces (DevPulse canonical)

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

---

## Weekly Review Template

```
Week: ___
Critical blockers open: ___
High items open: ___
Decisions needed: ___
Next week focus: ___
```
