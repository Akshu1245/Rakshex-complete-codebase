# Release checklist

**Product status:** Code is market-ready for private beta / waitlist / free self-serve (2026-07-30).  
Use this list before each production cut. Automated gates must be green; manual journeys are operator sign-off.

## Automated (must be green)

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:integration` (with real Postgres/Redis when available)
- [ ] `pnpm test:security`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e` (or CI E2E job)
- [ ] `docker compose build`
- [ ] `docker compose up -d` (or infra subset + app)
- [ ] `pnpm smoke:test` against the deployed URL
- [ ] `pnpm market:check`
- [ ] CI release-gate job green (audit, secrets, SBOM, container scan)

## Manual product journeys (real services)

- [ ] Register / login / logout / MFA path if enabled
- [ ] Create workspace; invite + accept path
- [ ] Import collection; no crash on large/invalid YAML
- [ ] Run scan; findings appear and can change status
- [ ] Kill switch trigger blocks subsequent model routing (gateway)
- [ ] Policy dry-run + publish
- [ ] Data export prepare/download
- [ ] Waitlist submit + confirmation attempt
- [ ] Billing webhook path with **test** provider keys only (if shipping billing)
- [ ] CLI scan produces SARIF/JSON on sample collection
- [ ] VS Code: set API URL, scan workspace, view findings

## Documentation

- [ ] README maturity table still accurate
- [ ] `docs/FEATURE_MATURITY.md` matches shipped surfaces
- [ ] No new certification / patent / unverified readiness claims
- [ ] `docs/DEPLOYMENT.md` version/tag recorded for rollback
- [ ] `docs/MARKET_READY_COMPLETE.md` still reflects intent of this release

## Explicit do-not-ship if

- Critical severity findings open in `docs/market-readiness-audit.md`
- Health checks green while primary journey fails
- Secrets in repo or logs
- Claiming SOC 2 / ISO certification without external audit

## Operator before paid public launch

- [ ] Live payment keys + one successful charge/refund
- [ ] Legal sign-off (`docs/operations/LEGAL_LAUNCH_SIGNOFF.md`)
- [ ] Production monitoring + on-call named

**Private beta / free waitlist:** may ship when automated gates + core manual journeys pass.
