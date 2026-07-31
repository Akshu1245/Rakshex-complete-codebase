# Production Deployment Runbook

Owner: Engineering
Last reviewed: 2026-07-30
Deployment model: Vercel web + Railway API, worker, PostgreSQL, and Redis

This runbook is an executable launch checklist. A deploy is not production-ready until every
required check is recorded with a timestamp, operator, environment, and evidence link.

## Required services

| Service    | Artifact/config                               | Health or proof                                   |
| ---------- | --------------------------------------------- | ------------------------------------------------- |
| Web        | `apps/web`, `apps/web/vercel.json`            | HTTPS page and authenticated dashboard            |
| API        | Docker target `api`, `railway.toml`           | `/api/health` and `/api/ready` return 200         |
| Worker     | Docker target `worker`, `railway.worker.toml` | worker log and completed canary job               |
| PostgreSQL | managed PostgreSQL                            | migration succeeds; backup/restore evidence       |
| Redis      | managed Redis                                 | API readiness and BullMQ canary                   |
| Email      | verified SMTP sender/domain                   | invite, reset, alert, and billing email delivered |
| Monitoring | Sentry, uptime, metrics                       | synthetic checks and alert delivery               |

The API and worker are separate Railway services built from the same repository. Do not expose the
worker publicly and do not deploy only the API: scans and email jobs would remain queued.

## Secret and environment setup

Use `.env.example` as the schema. Store values only in the hosting provider's encrypted secret
store. Generate independent values for staging and production.

Required for API startup in production:

- `NODE_ENV=production`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
- `FRONTEND_URL`, `APP_URL`, exact `CORS_ORIGINS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `METRICS_TOKEN`, `GITHUB_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` before paid checkout
- `GATEWAY_SERVICE_TOKEN` when internal gateway endpoints are enabled

Required for Vercel:

- `NEXT_PUBLIC_TS_API_URL=https://<api-host>`
- `NEXT_PUBLIC_SITE_URL=https://<web-host>`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID=<public key>` for paid checkout
- `NEXT_PUBLIC_SANDBOX_MODE=false`

## Deploy order

1. Take and verify a database backup.
2. Record the prior API, worker, and web release identifiers.
3. Build both Docker targets in CI and pass the full release gate.
4. Run `pnpm --filter @rakshex/database db:migrate` once as the pre-deploy job.
5. Deploy worker, then API, then web.
6. Confirm `/api/health`, `/api/ready`, metrics authentication, and error monitoring.
7. Submit one canary collection scan and verify the worker completes it.
8. Complete the signed buyer journey and cross-tenant authorization probe.
9. Observe error rate, queue depth, latency, and database saturation for at least 30 minutes.

## Payment acceptance

Before enabling a paid CTA:

1. Verify the Razorpay plans match configured integer minor-unit amounts.
2. Register the production webhook and exact secret.
3. Buy a workspace subscription with the minimum seat allocation.
4. Verify the signed webhook activates the workspace plan.
5. Add a member, reject an over-capacity invite, increase seats, and add the member.
6. Verify invoice/payment rows preserve paise in `amount_minor`.
7. Exercise payment failure, retry notification, period-end and immediate cancellation, refund,
   and reconciliation.

## Rollback

Application rollback is a redeploy of the prior immutable image/web release. Database migrations
must be forward-fix by default. Use a down migration only after confirming it cannot discard data
created by the new version.

1. Disable paid signup and new background jobs if the failure can compound.
2. Redeploy the previous web, API, and worker versions.
3. If schema incompatibility remains, apply an approved forward compatibility migration.
4. Record impact, timeline, evidence, and follow-up actions in an incident record.

## Release evidence

- [ ] CI release gate URL and commit SHA
- [ ] API/worker/web immutable release IDs
- [ ] migration log and backup/restore record
- [ ] canary scan job ID and signed buyer journey
- [ ] payment/refund evidence when paid signup is enabled
- [ ] monitoring links and named rollback operator
