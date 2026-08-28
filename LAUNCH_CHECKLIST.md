# RaksHex private-beta launch checklist

**Updated:** 2026-08-28

This is the current operational launch gate. It deliberately avoids "100% complete" language and does not treat roadmap integrations as shipped features.

> Vercel production promotion is intentionally deferred for the current consolidation pass. Finishing the repository and merging a green commit to `main` is separate from promoting the web deployment.

## 1. Source-control gate

- [ ] The intended release commit is on `main`.
- [ ] No open PR contains newer required product code.
- [ ] Old branches have been checked for unique work; superseded branches are **not** blindly merged.
- [ ] `README.md`, `CLAUDE.md`, and this file agree on runtime, product stage, and non-claims.
- [ ] Public UI does not advertise unsupported provider-native capabilities, certifications, fake customer proof, or unpublished package install paths.

## 2. Automated release gate

The release commit must pass the GitHub **CI** workflow and the independent **Security scan** workflow.

The CI release gate includes:

- frozen pnpm install
- format check
- lint
- TypeScript/type checking
- Node/package unit tests
- Python SDK tests on Python 3.10 and 3.12
- integration tests with PostgreSQL and Redis
- security-focused tests
- production build
- Docker API/worker builds
- PostgreSQL migration + backup/restore smoke
- Playwright smoke (health, login, Agent Firewall decision)
- production dependency audit
- Gitleaks secret scan
- CycloneDX SBOM generation
- Trivy container scan for high/critical vulnerabilities

Do not promote a commit if any required job is red or skipped because of an upstream failure.

## 3. Runtime baseline

Use the same declared runtime everywhere:

- Node.js **24.x**
- pnpm **10.32.1**
- PostgreSQL (the repository does **not** use MySQL)
- Redis for queues/low-latency enforcement state
- Python **>=3.10** only for the Python SDK

Production Docker images are also based on Node 24.

## 4. Required backend configuration

At minimum, enforced private-beta flows require correctly scoped production values for:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL`
- `JWT_SECRET` — strong production secret
- `RAKSHEX_VAULT_KEY` — strong production key; load-bearing for encrypted stored credentials
- production frontend/origin configuration (`FRONTEND_URL` / `CORS_ORIGINS` as used by the deployment)

Never commit production values to GitHub or expose server secrets through `NEXT_PUBLIC_*` variables.

Feature-specific credentials are required only when that feature is enabled, for example SMTP/email, GitHub App, provider credentials, Sentry/OTel exporters, or payment-provider credentials.

## 5. Database gate

Use the repository migration runner, not an ad-hoc Drizzle command:

```bash
pnpm db:migrate
```

The runner is PostgreSQL-only and uses the ordered SQL files in `packages/database/drizzle`.

Before production promotion:

- [ ] Migration job passes on a clean PostgreSQL database.
- [ ] Backup/restore smoke passes.
- [ ] `packages/database/src/migrate.order.test.ts` passes; it fails when a forward migration exists outside `MIGRATION_ORDER`.
- [ ] Production backup ownership and retention are assigned to a real operator.

## 6. API + worker gate

Deploy the API and BullMQ worker as separate processes/images.

Before routing beta traffic:

- [ ] API process starts with production configuration.
- [ ] Worker process starts and can reach Redis/PostgreSQL.
- [ ] `GET /api/health` is healthy.
- [ ] `GET /api/health/ready` is healthy before traffic is admitted.
- [ ] Queue failures do not silently fall back to an in-memory production mock.
- [ ] A real Agent Firewall ALLOW and DENY path is exercised against the deployed backend.
- [ ] A DENY does not release the mediated credential.
- [ ] Action Ledger evidence is written for the exercised decision path.
- [ ] Gateway kill switch is exercised for RaksHex-routed traffic.

## 7. Provider-governance truth gate

The team-governance capability catalog is the source of truth for provider-specific automation.

- [ ] `AVAILABLE` capabilities are exercised with real configured credentials before being called live.
- [ ] `NOT_CONFIGURED`, `NOT_IMPLEMENTED`, and `UNAVAILABLE` stay visible as such.
- [ ] Do **not** replace unsupported provider APIs with simulated success.
- [ ] Provider-native budget/seat controls are never described as universal.
- [ ] Direct provider traffic that bypasses RaksHex is not described as controlled by the RaksHex gateway kill switch.

## 8. SDK / developer surface gate

- [ ] Node SDK tests pass in the release gate.
- [ ] Python SDK tests pass on Python 3.10 and 3.12.
- [ ] Python `AgentFirewallClient` fail-closed behavior is exercised.
- [ ] Python package remains documented as source-install/private-beta until it is actually published on PyPI.
- [ ] VS Code extension Marketplace listing/install path is verified if it is being presented in the beta pitch.
- [ ] GitHub App flows are called available only when the production GitHub App configuration is present.

## 9. Payments, legal, and compliance boundary

Code existing is not the same as external readiness.

Before enabling paid public checkout:

- [ ] Live payment-provider credentials are installed through the deployment secret store.
- [ ] Real payment + webhook + refund/cancellation flows are exercised in the intended production provider mode.
- [ ] Tax/invoice obligations for the selling entity are reviewed.
- [ ] Terms, Privacy, DPA/data-retention language, and security representations are reviewed by the appropriate human/legal owner.

RaksHex compliance screens are evidence mappings. They are **not** SOC 2, ISO, GDPR, EU AI Act, PCI, or other certifications.

## 10. Monitoring and incident response

- [ ] Error/telemetry destination is configured for the production deployment.
- [ ] API readiness and public web availability are monitored externally.
- [ ] Alert ownership is assigned.
- [ ] `INCIDENT_RESPONSE.md` and `ONCALL_RUNBOOK.md` are reviewed against the actual deployment endpoints and contacts before relying on them operationally.
- [ ] Secret rotation procedure is tested for `JWT_SECRET`, `RAKSHEX_VAULT_KEY`, provider credentials, and payment secrets as applicable.

## 11. Web / Vercel gate — deferred in this pass

Do this only when web production promotion is intentionally resumed:

- [ ] Confirm the desired Vercel project and production branch.
- [ ] Confirm production API origin/TLS before pointing browser traffic at it.
- [ ] Confirm `rakshex.in`, `www`, and any API/docs subdomains resolve to the intended services.
- [ ] Run the investor path on mobile and desktop: Homepage → Product → Demo → Trust/Docs → Beta Request.
- [ ] Verify 404, error, empty, success, metadata/OG, favicon/app icon, and horizontal-overflow behavior on the deployed build.
- [ ] Run a final real-device smoke after DNS/TLS propagation.

## 12. Release decision

A repository commit is ready to merge when:

1. all intended code is in the PR,
2. no superseded branch is being mistaken for missing work,
3. the full CI release gate is green on the final head,
4. the independent Security scan is green on the final head, and
5. remaining items are explicitly external/operational rather than hidden code stubs.

A **private beta can proceed** after the applicable production backend, operator, security, and buyer-journey checks above are exercised. A **paid GA launch** has a higher bar and must not be inferred from green repository CI alone.
