# Launch Gap Register

This is the release gate for RakshEx. A checked item is implemented and verified in the repository. An external item requires an account owner or provider console and cannot be truthfully completed from source code alone.

## Implemented In Code

- [x] Workspace-scoped provider accounts, encrypted credentials, subscription seats, and cloud-resource inventory.
- [x] Metadata-only local discovery with fingerprints and masking.
- [x] Workspace usage rollups by user and model.
- [x] Runtime policy preview for budgets, provider/model allowlists, PII redaction, prompt-injection signals, tools, and kill switches.
- [x] Provider capability labels that distinguish connected, imported, estimated, and unavailable data.
- [x] Public waitlist route, persistence failure handling, confirmation-email attempt, and regression test.
- [x] Configurable beta countdown through `NEXT_PUBLIC_LAUNCH_DATE`.
- [x] Public trust center, security.txt, SEO metadata, robots, and sitemap alignment.
- [x] CI type checks, server tests, frontend build, VS Code type checks, and Playwright smoke coverage.
- [x] Customer-facing Terms, Privacy Policy, Cookie Policy, DPA, enterprise SLA, Acceptable Use Policy, Refund Policy, Subprocessor Register, and AI Transparency Statement drafted from current primary-source research.
- [x] Operational incident, privacy-request, retention, vendor-review, continuity, and legal-sign-off runbooks.
- [x] Railway production project with PostgreSQL, Redis, production secrets, a health check, repeatable Drizzle migration gate, and successful schema migration verification.

## Required Before Public Launch

- [x] Run all SQL migrations against the production PostgreSQL database and verify the migration journal.
- [x] Configure a 32+ character `JWT_SECRET` and `RAKSHEX_VAULT_KEY`; never use development defaults.
- [x] Configure `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `FRONTEND_URL`, and production CORS origins in the backend host.
- [ ] Set `NEXT_PUBLIC_TS_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_SITE_URL`, and optional `NEXT_PUBLIC_LAUNCH_DATE` in Vercel.
- [ ] Configure live Razorpay and/or Stripe keys, webhook secrets, products/prices, and execute a real payment/refund test.
- [ ] Configure SMTP or transactional email, verify `security@rakshex.in`, and submit a real waitlist request.
- [ ] Configure GitHub OAuth, Google OAuth, GitHub App installation, webhook secret, and callback URLs for production domains.
- [ ] Configure Sentry, uptime monitoring, backups, and a status-page owner.
- [x] Create and verify the Railway backend service, database, Redis, public health endpoint, and migration gate. GitHub Actions deployment remains manual and main-only until a verified-main deployment policy is configured.
- [ ] Configure provider connectors with customer-authorized OAuth/admin credentials; do not add provider secrets to environment files or the frontend.
- [ ] Obtain qualified legal review and complete legal-entity, GST, registered-address, named-grievance-officer, and authorised-signatory fields in `docs/operations/LEGAL_LAUNCH_SIGNOFF.md` before taking paid public orders.

## Commercial Follow-Through

- [ ] Verify tax/GST treatment, invoices, refund flow, dunning, and annual-contract process.
- [ ] Record a permitted customer reference before publishing a logo, quotation, benchmark, or savings claim.
- [ ] Run a clean-environment deployment and a complete buyer journey: waitlist, sign-in, workspace creation, scan, inventory, budget alert, payment, and data export.
- [ ] Publish a named on-call owner, tested security/privacy role email aliases, and incident communications process.

## What You May Need To Buy

- Production database and Redis capacity if the existing hosting plan does not include them.
- Transactional email service and a verified sending domain.
- Error monitoring and uptime monitoring plans if free tiers do not meet retention or alerting needs.
- Customer-contract tooling or legal review for enterprise DPA/SLA/security terms.
- Provider subscriptions or enterprise plans only where official admin APIs, SCIM, audit logs, or invoice exports require them.

The domains, source code, and deployment manifests are already present. These items are paid-account configuration or legal/operational decisions, not missing application code.

## Verified Railway Backend

- Project: `rakshex`
- Service: `rakshex-api`
- Public health URL: `https://rakshex-api-production.up.railway.app/api/health`
- Data services: Railway PostgreSQL and Redis
- Migration status: 7 recorded migrations, including the universal control-plane and durable GitHub-installation schema

The backend is reachable and schema-ready. It is not a complete paid launch until the remaining frontend, live-payment, email, identity, monitoring, provider-connector, and legal-owner items above are completed.
