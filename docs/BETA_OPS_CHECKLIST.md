# Beta ops checklist (Market Beta sprint)

Operator checklist for going live with Railway + Vercel. Code/IaC/runbook live in-repo;
items marked **manual** need founder accounts/secrets.

## Deploy

- [ ] Railway Postgres + Redis attached
- [ ] Railway **API** service (`railway.toml`, target `api`) deployed
- [ ] Railway **worker** service (`railway.worker.toml`, target `worker`) deployed — no HTTP healthcheck
- [ ] Migrations applied through `0020_gateway_audit_workspace`
- [ ] `GET /api/health` and `/api/health/ready` green
- [ ] Vercel web built with `NEXT_PUBLIC_TS_API_URL` + `NEXT_PUBLIC_SITE_URL` (+ optional `NEXT_PUBLIC_WS_URL`)
- [ ] `FRONTEND_URL` + `CORS_ORIGINS` include exact Vercel origin

Runbook: [DEPLOY_RAILWAY_VERCEL.md](./DEPLOY_RAILWAY_VERCEL.md)

## SMTP (**manual**)

- [ ] Production SMTP credentials set on Railway API (`SMTP_HOST`/`PORT`/`USER`/`PASS`/`FROM`)
- [ ] Invite email delivers
- [ ] Password-reset email delivers

## Payments — at least one rail (**manual**)

- [ ] Razorpay **or** Stripe keys on API
- [ ] Webhook endpoint configured:
  - Razorpay → `POST $APP_URL/api/webhooks/razorpay`
  - Stripe → `POST $APP_URL/api/webhooks/stripe`
- [ ] Test-mode checkout completes; subscription/payment row updates

## Observability (**manual**)

- [ ] `SENTRY_DSN` on API; `NEXT_PUBLIC_SENTRY_DSN` on Vercel
- [ ] Uptime check on `$APP_URL/api/health/ready` (1–5 min)
- [ ] Alert routes to on-call / founder inbox

## Buyer journey sign-off

Complete [STAGING_BUYER_JOURNEY.md](./STAGING_BUYER_JOURNEY.md) against **production/staging HTTPS**, not localhost.

Minimum path for beta:

1. Signup → workspace → import → scan (worker) → findings → export
2. Legal pages live: `/legal`, `/legal/dpa`, `/legal/sla`

## VS Code distribution

- [ ] Extension pointed at prod `rakshex.apiUrl`
- [ ] `npm run package` in `apps/vscode-extension` produces clean VSIX
- [ ] Marketplace: `vsce login rakshex` + `vsce publish` (**manual** — publisher PAT)

See `apps/vscode-extension/PUBLISHING.md`.

## Sign-off

| Role        | Name | Date | Notes |
| ----------- | ---- | ---- | ----- |
| Engineering |      |      |       |
| Ops         |      |      |       |
| GTM         |      |      |       |
