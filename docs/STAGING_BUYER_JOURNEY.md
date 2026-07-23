# Staging buyer journey checklist

Ops checklist for a staging (or pilot) environment before inviting a real buyer.
Mark items only after you have run them against the deployed staging stack.

## Prerequisites (operator)

- [ ] Staging API + web reachable over HTTPS
- [ ] `.env` / secret manager matches root `.env.example` critical vars (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_*`, `METRICS_TOKEN`, `CORS_ORIGINS`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_*`)
- [ ] Migrations applied (`pnpm db:migrate` / deploy migrate job)
- [ ] Redis is real (not MockRedis) — `/metrics` and scan queues healthy

## Product path

1. [ ] **Signup** — create a new account (email/password or OAuth)
2. [ ] **Workspace** — personal workspace exists; create/select an org workspace if needed
3. [ ] **Invite** — invite a second user; accept invite link; confirm RBAC (viewer cannot admin)
4. [ ] **Import** — import a Postman/OpenAPI/Bruno collection into the workspace
5. [ ] **Scan** — run a scan; job completes without silent mock findings
6. [ ] **Findings** — open findings UI; filter/export at least one format
7. [ ] **Pay** — start checkout (Razorpay and/or Stripe test mode); webhook marks subscription/payment correctly
8. [ ] **Export / delete** — prepare data export download; exercise account/workspace delete or data-deletion path if offered

## Integration sign-off

- [ ] **SMTP** — invite + password-reset emails deliver (fail-closed if SMTP missing in production)
- [ ] **Payments** — test-mode keys only on staging; webhook signatures verified; amounts match provider dashboard
- [ ] **GitHub App** — install URL resolves (`GITHUB_APP_SLUG` or numeric id); webhook rejects bad/missing signatures; no mock repos in staging/production
- [ ] **Legal** — privacy policy, terms, and DPA links live and reviewed by counsel/ops

## Security spot-checks

- [ ] Cross-tenant: user A cannot open user B collection/finding IDs (expect 403/404)
- [ ] CORS: unlisted origin cannot credentialled-fetch the API
- [ ] `/metrics` requires `METRICS_TOKEN` bearer

## Sign-off

| Role        | Name | Date | Notes |
| ----------- | ---- | ---- | ----- |
| Engineering |      |      |       |
| Ops / SRE   |      |      |       |
| GTM / Sales |      |      |       |

Related: [DEPLOY_RAILWAY_VERCEL.md](./DEPLOY_RAILWAY_VERCEL.md), [BETA_OPS_CHECKLIST.md](./BETA_OPS_CHECKLIST.md), [MARKET_READINESS_LAUNCH_BAR.md](../MARKET_READINESS_LAUNCH_BAR.md), [FEATURE_MATURITY.md](./FEATURE_MATURITY.md).
