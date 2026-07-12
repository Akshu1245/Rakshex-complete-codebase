# Release checklist

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
- [ ] CI release-gate job green (audit, secrets, SBOM, container scan)

## Manual product journeys (real services)

- [ ] Register / login / logout
- [ ] Create workspace; invite path if enabled
- [ ] Import collection; no crash on large/invalid YAML
- [ ] Run scan; findings appear and can change status
- [ ] Kill switch trigger blocks subsequent model routing (if gateway enabled)
- [ ] Billing webhook path with **test** provider keys only (if shipping billing)
- [ ] CLI scan produces SARIF/JSON on sample collection

## Documentation

- [ ] README maturity table still accurate
- [ ] No new certification / patent / unverified readiness claims
- [ ] DEPLOYMENT.md version/tag recorded for rollback

## Explicit do-not-ship if

- Critical severity findings open in `docs/market-readiness-audit.md`
- Health checks green while primary journey fails
- Secrets in repo or logs
