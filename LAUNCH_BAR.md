# DevPulse Launch Bar — Market Readiness Criteria

## Pass Criteria (Non-Negotiable)

### CI/CD Gates

- [x] `pnpm audit --audit-level moderate` exits non-zero on vulnerable deps (no `continue-on-error`)
- [ ] `tsc --noEmit` passes with zero errors (backend)
- [ ] `tsc --noEmit` passes with zero errors (frontend)
- [x] Trivy scan exits non-zero on CRITICAL/HIGH CVEs (`exit-code: 1`)
- [ ] Minimum smoke E2E passing: landing → auth → first scan → billing view
- [x] GitHub webhook rejects unverified payloads in ALL environments (no dev bypass)

### Security Gates

- [x] All enterprise endpoints have workspace-scoped row-level queries (SELECT + UPDATE)
- [ ] Cross-tenant negative test suite: user A (workspace 1) → IDs from workspace 2 → 404
- [x] API keys hashed at rest (SHA-256 + pepper)
- [x] GitHub webhook signature verification mandatory (fail-closed in all environments)
- [x] Vault key does NOT fall back to JWT_SECRET
- [x] Payment webhook signature verified with RAZORPAY_WEBHOOK_SECRET (not KEY_SECRET)

### Deployment Gates

- [x] `POSTGRES_PASSWORD` must be explicitly set (fail-fast via `${POSTGRES_PASSWORD:?err}`)
- [x] Docker compose command uses exec form (`["node", "dist/server/_core/index.js"]`)
- [x] Frontend depends_on app with `condition: service_healthy`
- [x] `.dockerignore` is clean (no binary corruption)
- [x] `Dockerfile.prod` has `ENV NODE_ENV=production`
- [x] `devpulse-frontend/Dockerfile` has `ENV NODE_ENV=production` and Node 22
- [x] Migration chain is consistent (PostgreSQL dialect, all files in `migrations/`, journal complete)

### Billing Gates

- [x] Webhook signature uses correct secret
- [x] Idempotency enforced via `processedWebhookEvents` table
- [x] "created" subscription status fixed to "pending" (valid PostgreSQL enum)
- [ ] Currency unit regression tests (paise vs INR)
- [ ] Real-HMAC webhook integration test

### Product/UX Gates

- [x] `/audit-log` removed from public routes
- [x] Cookie consent pipeline unified (single `consent.ts` module)
- [ ] Privacy page aligned with Cookie Policy (no contradictions)
- [ ] Dead links and demo copy removed from production UI
- [ ] Brand naming consistent (DevPulse not RaksHex)

## Ownership

| Domain          | Owner         | Key Files                                                                |
| --------------- | ------------- | ------------------------------------------------------------------------ |
| Backend/API     | Backend Lead  | `server/api/enterprise/*`, `server/payments.ts`, `server/api/apiKeys.ts` |
| Frontend        | Frontend Lead | `devpulse-frontend/components/*`, `devpulse-frontend/app/*`              |
| Platform/DevOps | DevOps Lead   | `.github/workflows/ci.yml`, `docker-compose.prod.yml`, `Dockerfile*`     |
| Product/GTM     | Product Lead  | `README.md`, docs, runbooks                                              |

## Review Cadence

- **Twice-weekly** readiness review (Tues/Thu)
- Go/No-Go decision at end of Week 6
