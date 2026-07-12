# Implementation status

**Updated:** 2026-07-12  
**Rules:** Status reflects code + tests in this repo. **Production-ready** requires real implementation, authorization, error handling, unit + integration tests, docs, and successful production build.

Legend: **Not started** · **In progress** · **Implemented** · **Tested** · **Production-ready** · **Blocked**

---

| Milestone | Feature                            | Status          | Evidence / notes                                                |
| --------- | ---------------------------------- | --------------- | --------------------------------------------------------------- |
| 1         | Monorepo (pnpm + turbo)            | **Tested**      | `pnpm-workspace.yaml`, turbo; install/build pass                |
| 1         | TypeScript packages                | **Tested**      | Packages typecheck; web strictness loosened historically        |
| 2         | PostgreSQL schema + migrations     | **Tested**      | 0000–0009; foundation tests with real PG when available         |
| 2         | Redis                              | **Tested**      | Compose health; API cache/rate-limit                            |
| 3         | Auth (register/login/sessions)     | **Tested**      | Argon2id, auth.security tests                                   |
| 3         | OAuth PKCE                         | **Tested**      | oauthPkce tests; needs live provider for e2e                    |
| 3         | MFA / recovery codes               | **Tested**      | recoveryCodes tests                                             |
| 3         | Authorization / RBAC               | **Tested**      | rbac + authorization + tenantIsolation                          |
| 4         | Workspaces                         | **Implemented** | routers + DB; integration coverage partial                      |
| 4         | Projects                           | **Implemented** | `api/projects.ts`                                               |
| 4         | Hashed API keys                    | **Tested**      | workspaceApiKeys tests                                          |
| 5         | Secure OpenAPI/Postman import      | **Tested**      | secureParse tests; external $ref blocked                        |
| 6         | Deterministic scanner core         | **Tested**      | scanner-core fixtures + engine tests                            |
| 6         | Scan worker                        | **Implemented** | BullMQ scan worker                                              |
| 7         | Findings workflow                  | **Tested**      | findings API + tests                                            |
| 7         | Risk assign / suppress / accept    | **Implemented** | lifecycle statuses in schema + API                              |
| 8         | Frontend real backend              | **Implemented** | scanning/findings/login wired; some pages Beta UI               |
| 9         | VS Code extension                  | **Implemented** | scan workspace; SecretStorage; marketplace Beta                 |
| 10        | CLI                                | **Tested**      | cli tests; SARIF/JSON/terminal                                  |
| 11        | GitHub App / Action                | **Implemented** | githubCiScan + action; live GH credentials Blocked for full e2e |
| 12        | AgentGuard Node SDK                | **Tested**      | privacy, fail-open, security contracts                          |
| 12        | AgentGuard Python SDK              | **Implemented** | package + tests (need pip env)                                  |
| 13        | Gateway enforcement                | **Tested**      | enforcement unit tests                                          |
| 13        | Kill switch server-side            | **Tested**      | DB-backed on gateway.evaluate + telemetry 403                   |
| 13        | Kill switch multi-agent Redis prop | **In progress** | helpers present; full multi-scope incomplete                    |
| 14        | Policy-as-code                     | **Tested**      | policy-engine lifecycle + evaluate                              |
| 14        | Policy enforcement on telemetry    | **Implemented** | middleware/policyEnforcement + cache                            |
| 15        | Versioned pricing                  | **Tested**      | pricing-engine historical stability tests                       |
| 15        | Cost budgets / dashboards          | **Implemented** | kill switch budget + cost APIs; dashboards Beta                 |
| 16        | MCP security / inventory           | **Tested**      | mcp-security package; API governance Beta                       |
| 17        | Compliance evidence export         | **Tested**      | compliance-engine; **not** certification                        |
| 18        | Billing abstraction                | **Tested**      | provider tests; live Stripe/Razorpay **Blocked** without keys   |
| 18        | Webhook verification + idempotency | **Implemented** | existing payments + memory provider tests                       |
| 19        | OpenTelemetry / logging            | **Implemented** | tracing bootstrap, pino redaction                               |
| 19        | Privacy modes / zero-retention     | **Tested**      | SDK + retention helpers                                         |
| 20        | Unit tests (packages)              | **Tested**      | `pnpm test` green                                               |
| 20        | Integration / security tests       | **Tested**      | `test:integration`, `test:security`                             |
| 20        | E2E Playwright                     | **In progress** | smoke + login-to-scan; CI webServer monorepo                    |
| 21        | CI/CD production gates             | **Implemented** | full workflow; confirm first GH green                           |
| 21        | Production Docker                  | **Implemented** | non-root, healthchecks; full image build not always run locally |
| 22        | Documentation honesty              | **Implemented** | maturity matrix, non-claims                                     |
| 23        | Market-readiness audit             | **Implemented** | this file + market-readiness-audit.md                           |

---

## Production-ready summary

**Nothing is marked Production-ready** for customer launch until:

1. Staging primary journey signed off (signup → import → scan → findings → kill switch).
2. CI release-gate green on GitHub Actions.
3. Live billing webhooks verified if paid plans ship.
4. Kill-switch multi-tenant workspace scope finalized if multi-account workspaces are sold.

Closest to production: **scanner-core**, **policy-engine**, **auth password hashing**, **secure import parse**, **AgentGuard Node SDK contracts**.

---

## Primary user journey map

| Step                       | Backend path               | Status                          |
| -------------------------- | -------------------------- | ------------------------------- |
| Sign up securely           | auth + password Argon2id   | Tested                          |
| Create workspace           | workspaces router          | Implemented                     |
| Create project             | projects router            | Implemented                     |
| Import OpenAPI/Postman     | collections + secureParse  | Tested                          |
| Deterministic scan         | scanner-core + worker      | Tested / Implemented            |
| Findings + remediation     | findings API + web         | Tested / Implemented            |
| Assign / suppress / accept | findings lifecycle         | Implemented                     |
| GitHub PR scan             | githubCiScan               | Implemented (live GH Blocked)   |
| VS Code                    | extension                  | Implemented                     |
| AgentGuard SDK/gateway     | SDK + controlPlane.gateway | Tested                          |
| Usage/cost monitor         | telemetry + pricing        | Implemented                     |
| Policies enforce           | policy-engine + middleware | Tested                          |
| Kill switch blocks         | DB + gateway + telemetry   | Tested                          |
| Compliance export          | compliance-engine          | Tested                          |
| Billing limits             | planLimits + payments      | Implemented (live keys Blocked) |
| Audit sensitive actions    | createAuditLogEntry        | Implemented                     |

---

## Remaining blockers

| ID  | Blocker                                      | Severity                   |
| --- | -------------------------------------------- | -------------------------- |
| B1  | Staging full-journey sign-off not completed  | High                       |
| B2  | Live Stripe/Razorpay webhook environment     | Medium (if billing in cut) |
| B3  | Live GitHub App credentials for PR e2e       | Medium                     |
| B4  | Confirm CI e2e job green on Actions          | High                       |
| B5  | Residual DevPulse branding in extension/demo | Low                        |
