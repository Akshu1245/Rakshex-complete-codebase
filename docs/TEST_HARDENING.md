# Test hardening (PROMPT 20)

## Goals

- Prefer real PostgreSQL and Redis in integration/E2E (via docker compose)
- Remove fake-only E2E coverage where product paths exist
- Security regression suite for authz, CSRF, SSRF, injection, XSS, YAML bombs, upload limits, webhook replay, API-key leakage, kill-switch/policy bypass
- Coverage thresholds without padding tests

## How to run

```bash
pnpm db:up
pnpm test:packages
pnpm test:api
# E2E (web + api running, real services):
pnpm --filter @rakshex/web exec playwright test
```

## Coverage

Package vitest configs should fail CI on test failure. Meaningful coverage targets for new packages:

| Package           | Target lines |
| ----------------- | ------------ |
| agentguard-sdk    | ≥70%         |
| policy-engine     | ≥80%         |
| pricing-engine    | ≥80%         |
| mcp-security      | ≥70%         |
| compliance-engine | ≥70%         |

Do not add empty `expect(true)` tests to inflate coverage.

## Security suites (API)

Existing and new tests under `apps/api`:

- `services/gateway/enforcement.test.ts` — kill switch, bypass, race, fail modes
- `services/billing/provider.test.ts` — webhook idempotency, entitlements
- `services/privacy/retention.test.ts` — anonymization
- Auth/BOLA tests in `services/authorization.test.ts`, `services/tenantIsolation.test.ts`
- Collection import YAML/JSON bombs in `services/collectionImport/secureParse.test.ts`

## Known limitations

1. Full multi-provider gateway proxy load tests require live provider credentials (not in CI).
2. Playwright E2E needs a running API + seeded DB; CI should use service containers.
3. Some legacy kill-switch tests still mock DB layers; prefer enforcement unit tests + integration when DB is available.
4. Razorpay/Stripe live webhooks are verified in integration with signed fixtures; production secrets stay out of repo.
5. Load tests (`k6` / artillery) are optional outside default `pnpm test` to keep CI time bounded.

## CI contract

- Any non-zero vitest/playwright exit code fails the pipeline
- Do not use `--passWithNoTests` for critical packages
