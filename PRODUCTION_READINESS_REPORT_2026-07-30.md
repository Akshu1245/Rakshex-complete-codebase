# RaksHex Production Readiness Report

**Assessment date:** 2026-07-30
**Result:** Release-candidate ready at the code level. Production launch remains conditional on the external staging and operational gates below.

No responsible engineering review can guarantee that a system is “bulletproof.” This pass instead removed the reproducible release blockers, tightened high-risk paths, and records the evidence and remaining launch conditions.

## What was fixed

### Correctness and tenant safety

- Fixed the onboarding team-status mismatch (`active` versus the actual `accepted` state).
- Replaced MySQL-style `insertId` and `affectedRows` assumptions with PostgreSQL `RETURNING` and `rowCount` handling across workspace, invitation, SSO, policy, and alert creation/deletion paths.
- Repaired onboarding tests so completion depends on real event-backed progress rather than permissive mocks.
- Added missing workspace and collection pagination mocks to scanning and router tests.

### Queue and import reliability

- Removed the legacy worker’s collision with the production `background-scan` queue. Previously, workers with incompatible payload contracts could consume each other’s jobs.
- Added the missing web proxy for `/api/import/*`.
- Added CSRF enforcement to browser-based import preview and execution.
- Removed import formats advertised by the UI but not implemented by the backend.
- Prevented import failures from returning internal exception details to clients.

### Build, deployment, and CI

- Removed the build-time Google Fonts network dependency so production builds are deterministic in restricted CI.
- Reworked the web Dockerfile to install from the monorepo root with the frozen lockfile and the pinned package-manager version.
- Corrected Docker Compose build contexts and added a one-shot database migration service before API and worker startup.
- Changed local Compose defaults away from production mode and corrected the production frontend origin.
- Updated release scripts to use the repository-pinned pnpm through Corepack.
- Made live smoke testing conditional on an explicitly supplied `SMOKE_BASE_URL`.
- Fixed formatting failures and dependency/version drift that blocked CI.

### Security and public claims

- Updated Next.js, Axios, OpenTelemetry, tRPC, Sentry, PostCSS, Sharp, brace-expansion, and fast-uri constraints.
- Reduced the production dependency audit to **zero high or critical advisories**.
- Kept API-key import access compatible while requiring CSRF protection for cookie-authenticated browser requests.
- Removed an unsubstantiated community-size claim and replaced unsupported “Vanta/Drata ready” wording with accurate evidence-export language.

## Verification evidence

| Gate                                         | Result                                         |
| -------------------------------------------- | ---------------------------------------------- |
| Frozen-lockfile install with pnpm 10.32.1    | Pass                                           |
| Formatting check                             | Pass                                           |
| Monorepo lint                                | Pass                                           |
| Monorepo typecheck                           | Pass — 17/17 tasks                             |
| Full build                                   | Pass — 17/17 tasks; Next.js generated 93 pages |
| API unit suite                               | Pass — 68 files, 730 tests                     |
| Web unit suite                               | Pass — 30 tests                                |
| Focused API security suite                   | Pass — 10 files, 84 tests                      |
| AgentGuard security tests                    | Pass — 2 tests                                 |
| Release-gates script                         | Pass                                           |
| Production dependency audit at high severity | Pass — no high/critical advisories             |
| Docker Compose configuration parse           | Pass                                           |

Database integration tests that require a live PostgreSQL instance were skipped by their existing test guard. Docker was not available in this review environment, so actual image builds, migrations against a real database, browser E2E, Trivy scans, and live smoke checks must run in CI/staging before release.

## Required gates before production

### P0 — Release blockers

1. Run the complete GitHub Actions release workflow on the packaged source, including Docker image builds, secret scanning, SBOM generation, and Trivy scans.
2. Restore a production-like database backup in staging; run migrations, rollback/recovery drills, and tenant-isolation integration tests.
3. Run the full browser E2E suite against the staged web/API/worker/Redis/PostgreSQL stack.
4. Configure unique production secrets and validate rotation for JWT, encryption, OAuth/GitHub App, payment webhooks, SMTP, database, and Redis credentials.
5. Exercise checkout, webhook replay/idempotency, plan upgrades/downgrades, failed payments, cancellation, and entitlement reconciliation using the payment provider’s test environment.

### P1 — Reliability and security sign-off

1. Conduct an independent penetration test covering authentication, tenancy, SSRF, imports, webhooks, OAuth, file handling, rate limits, and privilege escalation.
2. Load-test scan submission, queues, report generation, and LLM-provider failure modes; set capacity limits from measured results.
3. Validate backup restore time, worker retry/dead-letter behavior, Redis/PostgreSQL failover, and graceful degradation when third-party providers fail.
4. Confirm dashboards, alert routes, log redaction, trace sampling, error budgets, paging policy, incident ownership, and runbooks.
5. Obtain legal review of Terms, Privacy, DPA, SLA, subprocessors, retention/deletion behavior, and every compliance or competitor comparison claim.

## Product and market launch order

1. **Lead with one wedge:** position RaksHex as the control plane for API and AI-agent security, access, cost, and audit evidence. Start with engineering/security teams operating production LLM workflows; avoid trying to sell every feature equally.
2. **Make activation unmistakable:** optimize the first session around import → scan → prioritized finding → policy action → evidence export. Instrument completion and time-to-value for every step.
3. **Build proof before reach:** ship a safe interactive demo, reproducible benchmark methodology, a transparent security page, and two or three verifiable design-partner case studies. Do not publish unsupported customer counts, savings, or compliance claims.
4. **Use product-led acquisition:** GitHub App, CLI, IDE workflow, free scan, and useful OWASP/SOC 2 evidence templates should feed qualified users into the hosted product.
5. **Create comparison pages with evidence:** retain the existing SEO surface, but review every competitor statement on a schedule and cite public sources. Explain workflow differences instead of making absolute superiority claims.
6. **Launch in measured stages:** design partners, private beta, public beta, then general availability. Promote through security/AI engineering communities, GitHub, technical content, partner channels, Product Hunt, Hacker News, and LinkedIn only after activation, retention, support, and incident metrics meet agreed thresholds.

## Recommended launch metrics

- Activation: percentage completing the import-to-evidence path within one session.
- Time to first actionable finding and time to first enforced policy.
- Weekly retained organizations and scans per retained organization.
- Finding-to-remediation conversion and false-positive dismissal rate.
- Trial-to-paid conversion, expansion, churn, gross margin, and support burden.
- Queue latency, scan success rate, webhook success rate, API error rate, and security incident count.

The codebase can now be treated as a release candidate. General availability should be approved only after every P0 gate has passed in the real deployment environment and the P1 owners have explicitly signed off.
