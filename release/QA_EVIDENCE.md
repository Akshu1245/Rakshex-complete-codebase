# QA Evidence — 2026-07-30

## Passed locally

| Gate                             | Result                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| Clean dependency resolution      | Pass; lockfile passed supply-chain policy                              |
| TypeScript                       | Pass; 17/17 workspaces                                                 |
| Unit/integration/component tests | Pass; 874 tests, 9 database tests skipped without a live test database |
| Lint                             | Pass; zero warnings                                                    |
| Formatting                       | Pass after full web and extension coverage                             |
| Production build                 | Pass; 17/17 workspaces, 93 Next.js routes generated                    |
| Runtime endpoint contract        | Pass; web and VS Code tRPC calls map to server procedures              |
| Customer-facing claims gate      | Pass                                                                   |
| Production dependency audit      | Pass; no known vulnerabilities                                         |
| Peer dependency check            | Pass                                                                   |
| VS Code package                  | Pass; `rakshex-vscode-0.2.1.vsix`                                      |

## Corrected during final verification

- workspace subscription persistence, seats, billing controls, and integer minor-unit money storage
- team invitations, roles, member identity display, last-owner safety, and cross-tenant invite deletion
- VS Code tRPC envelopes, API/dashboard origins, key prefixes, health endpoint, and scan queueing
- public status response contract and honest component labels
- MCP stdio `EPIPE` race handling
- Next.js middleware-to-proxy migration
- scoped VS Code manifest name rejected by Marketplace packaging
- unstable dependency ranges, supply-chain minimum-age failures, peer mismatches, and audit findings
- retired-brand and unsupported-claim regression protection

## Must run in connected staging/production

The local environment did not provide Docker or a downloadable Playwright browser
binary. The full Playwright suite and live PostgreSQL/Redis paths are configured
as CI/release gates but require connected infrastructure:

- run all GitHub Actions release jobs on the exact commit being deployed;
- run migrations against a staging backup/restore rehearsal;
- execute the signed HTTPS buyer journey;
- exercise SMTP invite/reset/alert delivery;
- exercise Stripe/Razorpay payment, failure, refund, webhook replay, and reconciliation;
- verify API and worker deployment, queue draining, alerts, Sentry, and uptime checks.

Do not mark the corresponding launch-signoff rows complete without attached
evidence.
