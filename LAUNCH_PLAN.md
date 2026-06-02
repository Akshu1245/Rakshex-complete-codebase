# RakshEx — Launch Plan (Owner's Pass)

_Last updated: June 2, 2026._

This is the honest "what it takes to make money" plan, written as if I owned the
company. It does **not** change the core idea: **catch AI/API security holes and
runaway LLM cost before they bite.**

---

## 1. Where it stands today

**Code quality:** strong. 600/600 backend tests, 30/30 frontend tests, 0 type
errors, 0 lint warnings, clean production `next build`.

**What changed in this pass (all verified):**
- Removed the last fake-data pages. `agent-drift`, `metrics`, and `benchmark`
  now render **real** data from the analytics/anomalies tRPC routers, with
  honest empty states when there's no telemetry yet.
- Built the **notification system** (table + router + live bell badge +
  `/notifications` feed), wired to fire when a scan is queued.
- Built a **feature-flag system** (table + router + `/admin/flags` UI +
  `isFeatureEnabled()` with deterministic percentage rollout).
- Built the **public, rate-limited demo scan endpoint** (`demo.scan`,
  15 scans/hour/IP) so the no-login demo runs server-side, with a client-side
  fallback so it never hard-fails.
- New tables ship as migration `drizzle/0001_notifications_and_feature_flags.sql`
  (applied + smoke-tested against real Postgres 16).

**What still blocks a paid launch (needs YOU, not code):**
1. **It isn't deployed/connected.** Frontend is live-quality, but the dashboard
   needs the Express/tRPC backend + a live Postgres + Redis running. Until that's
   up, login/dashboard can't load real data.
2. **Money isn't switched on.** Stripe needs live keys + webhook secret.
3. **Email isn't switched on.** Needs real SMTP creds.
4. **Proof.** Replace the fictional testimonials/benchmarks on marketing pages
   with real beta numbers before any paid push (credibility risk on a security
   product).

---

## 2. What I need from you to go live

| # | Item | Why | Where it goes |
|---|------|-----|---------------|
| 1 | A backend host (Railway/Render/Fly) | Run Express/tRPC API + workers | deploy target |
| 2 | `DATABASE_URL` (managed Postgres) | Real data store | backend env |
| 3 | `REDIS_URL` (managed Redis) | Cache, rate limits, BullMQ jobs | backend env |
| 4 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (+ price IDs) | Charge for Pro/Enterprise | backend env |
| 5 | SMTP creds (`SMTP_HOST/PORT/USER/PASS`) | Verification, alerts, digest | backend env |
| 6 | Frontend host (Vercel) + `NEXT_PUBLIC_API_URL` | Serve the dashboard | frontend env |
| 7 | (optional) `SENTRY_DSN` | Error monitoring | both |
| 8 | (optional) Google Sheet + Apps Script webhook | Turn on `waitlist_sheets_sync` flag | backend env |

Everything else is already coded. The moment you hand these over, it goes live.

---

## 3. Deploy order (fastest path to a working live app)

1. **Provision Postgres + Redis** (managed). Grab their URLs.
2. **Deploy backend** with env vars #2–#5, then run `./scripts/migrate.sh`
   (idempotent; applies `drizzle/` migrations including the new one).
3. **Deploy frontend** (Vercel) with `NEXT_PUBLIC_API_URL` pointing at the API.
4. **Stripe webhook** → point it at `/api/payments/webhook`, paste the signing
   secret into `STRIPE_WEBHOOK_SECRET`.
5. **Smoke test:** sign up → run a scan → see a notification → open dashboards.
6. **Publish distribution:** VS Code Marketplace (extension), npm (CLI),
   GitHub Marketplace (Action). All three are already coded.

---

## 4. Go-to-market (no change to the core idea)

**Wedge (top of funnel):** the free, no-login **demo scanner** + the **CLI** +
the **GitHub Action**. A dev scans a Postman/OpenAPI collection, sees real
findings (exposed keys, BOLA, missing auth, HTTP), and wants to save/track them
→ signs up. That's the viral loop.

**Activation:** onboarding wizard → import collection → first scan → first
finding fixed. Notifications + weekly digest pull them back.

**Distribution channels:**
- VS Code Marketplace + npm + GitHub Marketplace listings (SEO + discovery).
- Product Hunt / Hacker News / r/programming launch **once the backend is live**.
- "Scan your API in 3 seconds, no signup" as the single hero message.

---

## 5. Monetization (keep the existing 3 tiers)

| Tier | Price | Hook |
|------|-------|------|
| Free | $0 | Demo scanner, CLI, limited scans/day — the wedge |
| Pro | $99/mo | Scan history, scheduled scans, alerts, cost dashboards, GitHub Action in CI |
| Enterprise | $499/mo | SSO/SAML, RBAC, red-team, audit export, SLA |

**Add-on (later):** usage-based scan packs for CI-heavy teams (per-1k-scans),
so heavy automated users pay for what they consume without jumping tiers.

**Feature flags** now let us dark-launch paid features to a % of users and turn
risky integrations on/off without a redeploy.

---

## 6. The one credibility fix before paid push

Marketing pages still carry **fictional** testimonials/benchmark numbers. On a
security product that's the fastest way to lose trust. Before spending on
acquisition: run a small private beta, collect real numbers + 2–3 real quotes,
and swap them in. (The in-app metrics/benchmark pages already show real data, so
this is only the marketing copy.)
