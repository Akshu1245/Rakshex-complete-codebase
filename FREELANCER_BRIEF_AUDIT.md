# RaksHex — Freelancer Brief Audit

**Audited:** June 2, 2026 by Devin
**Codebase:** Rakshex-complete-codebase (this zip)
**Method:** Item-by-item verification of `RaksHex_Freelancer_Brief.docx` against the actual source, plus a full build/test/lint run.

> **Update (June 2, 2026 — owner pass):** The five remaining gaps below have now been closed and verified: BUG-010 (agent-drift), BUG-011 (metrics & benchmark), 5.1 (public demo scan endpoint), 5.5 (notifications), 5.8 (feature flags). The three mock-data pages now read real tRPC data; new `notifications` + `feature_flags` tables ship with migration `drizzle/0001_notifications_and_feature_flags.sql` (applied + smoke-tested against a real Postgres 16). Remaining items are integration-only (5.6 waitlist→Sheets, now gated behind a feature flag) or external infra (see bottom).

> Important: The brief describes the DB as **MySQL** and says "do NOT migrate to PostgreSQL." The delivered codebase actually runs on **PostgreSQL** (`pg` Pool, Drizzle `pgTable`, `@types/pg`). All tests pass against it, so the migration appears intentional and complete — but it contradicts the brief, so flagging it.

## Build / Test Verification (run today)

| Check | Command | Result |
|-------|---------|--------|
| Backend typecheck | `npx tsc --noEmit` | 0 errors |
| Backend tests | `vitest run` | **600/600 pass** (40 files) |
| Frontend typecheck | `cd rakshex-frontend && tsc --noEmit` | 0 errors |
| Frontend tests | `cd rakshex-frontend && vitest run` | **30/30 pass** (7 files) |
| VS Code ext typecheck | `cd rakshex-vscode && tsc --noEmit` | 0 errors |
| Lint | `eslint . --max-warnings=0` | 0 errors / 0 warnings |

## P0 — Critical Bugs (8/8 DONE)

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| BUG-001 | DB connection pool limit | DONE | `server/db.ts` pg `Pool({ max: 20, idleTimeoutMillis, connectionTimeoutMillis })` |
| BUG-002 | WebSocket session/JWT expiry | DONE | `server/utils/security.ts verifyWebSocketAuth` checks `session.expiresAt`, deletes expired sessions, rejects locked accounts |
| BUG-003 | Graceful shutdown on SIGTERM | DONE | `server/_core/index.ts` SIGTERM → `server.close()` + `flushSecurityEventsOnShutdown()` |
| BUG-004 | Pagination on list endpoints | DONE | `scanning.listScans` (page/pageSize), `collections.list` (cursor/limit), `audit.listEntries` (cursor/offset/nextCursor) |
| BUG-005 | redTeamScheduler worker failing | DONE | `redTeamScheduler.ts` wrapped in try/catch + env guard; failure no longer blocks startup |
| BUG-006 | SAML XML signature stubbed | DONE | `ssoSaml.ts` uses `xml-crypto` `SignedXml.checkSignature` (+ `ssoSaml.test.ts`) |
| BUG-007 | OIDC ID-token JWS not verified | DONE | `ssoOidc.ts` uses `jose` `jwtVerify` + `createRemoteJWKSet` from discovery `jwks_uri` (+ `ssoOidc.test.ts`) |
| BUG-008 | Security events not persisted | DONE | `securityEvents` pgTable + `flushSecurityEvents()` batch insert + 30s flusher + shutdown flush |

## P1 — Demo & UX Blockers (8/8 DONE in code; publish/infra external)

| ID | Item | Status | Evidence / Gap |
|----|------|--------|----------------|
| BUG-009 | Stripe payments wired | DONE | `server/stripe.ts createCheckoutSession` + `verifyStripeWebhookSignature` (HMAC) + `payments.ts` rejects invalid sig + `stripe.test.ts` (12 tests). Razorpay still intact. |
| BUG-010 | Agent-drift uses mock data | **DONE** | `app/agent-drift/page.tsx` now reads `trpc.analytics.anomalies` (7-day rolling cost-drift detection) with live polling, loading + empty states. `MOCK_DRIFT_EVENTS` removed. |
| BUG-011 | Metrics & benchmark mock data | **DONE** | `app/metrics/page.tsx` reads `trpc.analytics.summary` + `analytics.modelMix`; `app/benchmark/page.tsx` reads `analytics.summary` grouped by model. All hardcoded arrays removed; honest empty states when no telemetry. |
| BUG-012 | Missing loading states | DONE | 46 `loading.tsx` files across `app/` |
| BUG-013 | Empty states missing CTAs | DONE | `components/EmptyState.tsx` |
| BUG-014 | Mobile sidebar broken | DONE | `AppShell.tsx` hamburger (`onMenuOpen`/`setSidebarOpen`) + responsive `md:ml-64` |
| BUG-015 | tRPC type inference / `as any` | DONE (effectively) | Down from 23+ to 13 `as any`: 11 are test mocks (`global.fetch as any`), 1 is the Razorpay `window` global, 1 real (`research/page.tsx`). Typecheck is clean. |
| BUG-016 | Email system not configured | DONE | `server/email.ts` nodemailer SMTP transport + multiple HTML templates |
| BUG-017 | GitHub Action not published | CODE READY (publish is external) | `github-action/` has `action.yml`, `Dockerfile`, `entrypoint.sh`, `pr-comment.js`; `publish-extension.yml` workflow present. Actual Marketplace publish must be done on GitHub. |

## P2 — Production Stability

| ID | Item | Status | Notes |
|----|------|--------|-------|
| BUG-018 | No DB backups | EXTERNAL | Railway/infra setting — not verifiable from code |
| BUG-019 | 69 TODO/FIXME not triaged | DONE | Only 2 TODO/FIXME remain in `server/` |
| BUG-020 | Waitlist → Google Sheets | **NOT DONE** | `api/waitlist.ts` only inserts to DB + sends email; no Apps Script / Sheets call |
| BUG-021 | Unused MySQL service on Railway | EXTERNAL | Infra cleanup — not verifiable from code |
| BUG-022 | Sentry DSN not configured | EXTERNAL | Sentry is initialized in code; DSN is an env var set at deploy time |

## Section 5 — What Still Needs To Be Built

| Ref | Item | Status | Notes |
|-----|------|--------|-------|
| 5.1 | Public demo scanner | **DONE** | `server/api/demo.ts` `demo.scan` (public, IP rate-limited 15/hr via Redis + in-memory fallback, 2MB payload cap) backed by pure `server/utils/demoScanner.ts` (4 unit tests). `app/demo/page.tsx` calls it, with a client-side fallback so the no-login demo still works if the backend is down. |
| 5.2 | GitHub Action publish | CODE READY | Same as BUG-017 — code complete, Marketplace publish is external |
| 5.3 | Onboarding flow | DONE | `users.onboardingCompleted` column + `onboarding_progress` table + `api/onboarding.ts` |
| 5.4 | Shareable scan reports | DONE | `reports.create` (shareToken, inserts `scanReports`) + public `publicReports.getByScanId` |
| 5.5 | Notification system | **DONE** | `notifications` table + `server/api/notifications.ts` (list/unreadCount/markRead/markAllRead + `createNotification` helper, wired into `startScan`). `NotificationBell` shows a live unread badge; `/notifications` is a full feed with mark-read. |
| 5.6 | Waitlist → Google Sheets | **NOT DONE (gated)** | Still DB + email only; the Apps Script/Sheets call is an external integration needing the user's Sheet + webhook URL. A `waitlist_sheets_sync` feature flag is the intended gate so it can be switched on without a redeploy once credentials exist. |
| 5.7 | Loading skeletons + error boundaries | DONE | 46 `loading.tsx` + 22 `error.tsx` + `EmptyState` |
| 5.8 | Feature flags system | **DONE** | `feature_flags` table + `server/api/featureFlags.ts` (`listAll`/`enabled`/`upsert`/`toggle` + `isFeatureEnabled(key, subject)` with deterministic % rollout bucketing) + `/admin/flags` toggle UI. |
| 5.9 | Weekly digest email | DONE | `server/jobs/weeklyDigest.ts` schedules via `node-cron` (`0 9 * * 1`) |
| 5.10 | Admin dashboard | DONE | `app/admin/page.tsx` wired to `trpc.admin.listAllUsers/getSystemStats/changeUserPlan` + `/admin/waitlist` |
| 5.11 | CI/CD pipeline | CONFIG READY | `.github/workflows/`: `ci.yml`, `publish-extension.yml`, `security-scan.yml`. Repo secrets are external. |

## Bottom line

- **All P0 (security/stability) bugs are fixed and tested.**
- **All P0 + P1 code items are now DONE**, including the previously-flagged mock-data pages (BUG-010, BUG-011).
- **Newly closed this pass:** notification system (5.5), feature flags (5.8), public rate-limited demo scan endpoint (5.1).
- **Still outstanding (integration, not code):** waitlist→Google Sheets (5.6 / BUG-020) needs the user's Sheet + Apps Script webhook; it is gated behind the `waitlist_sheets_sync` feature flag.
- **External/infra (cannot be verified from code):** DB backups (BUG-018), unused Railway MySQL cleanup (BUG-021), Sentry DSN (BUG-022), GitHub Marketplace publish (BUG-017/5.2), CI repo secrets (5.11).
