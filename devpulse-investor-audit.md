# Rakshex — Full Codebase Audit

### Investor-Pitch Readiness Report | May 2026

---

## Executive Summary

**Codebase size:** 452 files across 6 modules (server, frontend, VS Code extension, SDK, GitHub Action, agents)  
**Test suite:** 36 test files | 478+ passing server tests | 68 gateway tests | 14 VS Code tests | 5 E2E specs  
**Migrations:** 18 Drizzle SQL migrations (full schema history committed)  
**Agent architecture:** 32 specialized agents defined in `/agents/`  
**Overall market readiness (self-assessed in MARKET_READINESS.md):** ~92%  
**My honest re-assessment:** **78–82%** (see below — they overcounted several "done" items)

---

## Module-by-Module: What's Real

### 1. Server Backend (`/server/`)

**Strength: 9/10. The strongest part of the codebase.**

37 tRPC API routers covering:

- Auth (email/password, Google OAuth, 2FA TOTP, session mgmt, password reset)
- Collections, Scanning, Shadow API, Token Analytics
- Kill Switch, Compliance, Team management, Onboarding
- Admin, Payments (Stripe), Webhooks, MCP Governance
- Runtime Governance, Risk Score, SOC2, Policies, Alerts
- Data Export, API Docs portal, SSO (SAML+OIDC), Workspaces, Telemetry

58 service modules including:

- `unifiedRiskScore.ts` — weighted combined scoring engine
- `redTeamRunner.ts` + `redTeamScheduler.ts` — automated red-team with scoring
- `secretScanner.ts` — 10-rule secret detection engine (AWS keys, GitHub PATs, Stripe live keys, JWT, etc.)
- `shadowAi.ts` + `collectionCredentialScan.ts` — shadow AI detection pipeline
- `socTwoEvidence.ts` — 11-control SOC2 evidence pack builder
- `policyDsl.ts` — YAML policy DSL parser/compiler
- `rbac.ts` + `workspaceContext.ts` — 4-role RBAC with 9 resources × 3 actions
- `encryptedVault.ts` — AES-256-GCM per-tenant encrypted vault
- `ssoSaml.ts` + `ssoOidc.ts` + `ssoJitProvision.ts` — full SSO stack
- `alertRules.ts` + `alertDispatcher.ts` + Discord/PagerDuty integrations
- `forecasting.ts` — Holt-Winters double-exponential smoothing (zero external deps)
- `dataExport.ts` — JSON/NDJSON/CSV/PDF export with streaming for >5MB
- `openapiGenerator.ts` — walks live tRPC tree, emits OpenAPI 3.0.3 spec

**Real gaps:**

- AWS Bedrock provider — NOT built
- Distributed Redis rate limiting — only per-process (fine for single-instance)
- Hot-reload of policy config — requires restart
- `server/routers/_app-update.ts` shows `cost`, `fix`, `github` routers referenced but the file is a TODO note, not wired into `routers.ts` — the main router doesn't include those

---

### 2. Database (`/drizzle/schema.ts` — 1,412 lines, 18 migrations)

**Strength: 8.5/10.**

Tables confirmed real:

- `users`, `userSessions`, `auditLog`, `passwordResetTokens`
- `collections`, `scans`, `findings`, `tokenUsage`
- `vscodeActivities`, `webhooks`, `webhookEvents`
- `redteamRuns`, `redteamFindings`, `redteamSchedules`
- `autofixSuggestions`, `copilotConversations`, `copilotMessages`
- `aiTokenBudgets`, `promptInjectionEvents`
- `mcpServers`, `mcpTools`, `mcpAuditEvents`
- `runtimePolicies`, `tenantPolicies`
- `alertRules`, `alertEvents`
- `ssoProviders`, `workspaces`, `workspaceMembers`, `workspaceInvitations`
- `totpTokens`, `researchReports`, `importHistory`, `aiEvents`

**Real gaps:**

- No FK constraints in MySQL (Drizzle ORM level only) — a real enterprise database auditor will flag this
- Transaction wrappers missing in several write paths (create collection + scan + findings should be atomic)
- No soft-delete pattern (hard deletes on sensitive security data is a compliance risk)

---

### 3. Frontend (`/rakshex-frontend/`)

**Strength: 6.5/10. Structurally complete, but many pages are likely thin shells.**

28 app pages including:

- dashboard, collections, scanning, shadow-apis, token-analytics
- compliance, kill-switch, audit-log, analytics, admin
- billing (with success/failure flows), pricing, onboarding
- team, settings, red-team, import, research

15 components: AppShell, Sidebar, AuthProvider, Toast, PaywallModal, RiskChart, PlanUtilizationBanner, CookieConsent, etc.

5 E2E Playwright specs: auth flow, onboarding, kill-switch, pricing upgrade, team invite

**Real gaps:**

- `|| true` in CI for frontend TypeScript check — meaning frontend TS errors are silently ignored in CI. This is a major red flag.
- No mobile responsiveness confirmed
- Bundle size at 1.09 MB gzipped to 297 KB — route-level code splitting not done
- Per-page skeleton loaders — unclear if all 28 pages have them
- Import UI page exists (`/import/page.tsx`) but completeness unknown
- No screenshot or demo of actual running UI in the repo

---

### 4. VS Code Extension (`/rakshex-vscode/`)

**Strength: 7/10. Real code, real features, NOT yet published.**

14 source files including:

- `extension.ts` — command registrations
- `findingsProvider.ts` — tree view for security findings
- `securityWebviewPanel.ts` — security dashboard webview (previously flagged as missing — now EXISTS)
- `shadowApiScanner.ts` — static route extractor (Express, FastAPI, Flask, Django, Spring Boot, Laravel)
- `autofixProvider.ts` — autofix suggestions
- `gatewayTester.ts` — test prompt through gateway
- `statusBar.ts`, `heartbeat.ts`, `copilotView.ts`, `settingsWebview.ts`

**Real gaps:**

- VS Code Marketplace NOT published (requires your Microsoft Partner Center account)
- No JetBrains / Cursor plugin
- `securityWebviewPanel.ts` exists now but previous audit noted it was missing — need to verify it's fully wired

---

### 5. SDK (`/packages/rakshex-sdk/`)

**Strength: 8/10.**

- OpenAI and Anthropic wrappers
- Cost calculator (`cost.ts`) with token pricing
- PII redaction (`redact.ts`)
- Batch reporter
- Telemetry collector
- TypeScript declarations, `py.typed` marker

**Real gaps:**

- NPM/PyPI NOT published
- Anthropic Python wrapper not confirmed

---

### 6. GitHub Action (`/github-action/`)

**Strength: 5/10. Engine exists, wiring blocked.**

- HMAC-SHA-256 webhook verification
- Push + PR handlers for secret scanning
- `action.yml`, `entrypoint.sh`, Dockerfile

**Hard-blocked:** GitHub App registration required. ~30 minutes of paperwork you need to do personally.

---

### 7. Agent Architecture (`/agents/`)

**This is your CommandCode multi-agent setup, not product code.**

32 agent definition files (CEO, CTO, CPO, VP Engineering, QA, Backend Dev, Frontend Dev, etc.). These are your development environment, not part of what investors evaluate. Don't pitch this as a product feature.

---

## What's Genuinely Done vs. What Needs Work Before a Pitch

### ✅ DONE — Can demo today

| Feature                                                         | Evidence                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Email + Google OAuth auth                                       | `routers.ts` — full signup, login, logout, 2FA TOTP, password reset |
| API collection import (Postman/OpenAPI/Helicone/Portkey/Lakera) | `server/api/import.ts` + `importCompetitor.ts`                      |
| Security scanning engine                                        | `server/services/scanService.ts` + 87-payload injection library     |
| Token cost analytics                                            | `server/api/tokenAnalytics.ts` + forecasting service                |
| Kill switch                                                     | `server/api/killSwitch.ts` — tested E2E                             |
| Compliance dashboard                                            | `server/api/compliance.ts` + SOC2 evidence builder                  |
| Red-team scheduler                                              | `redTeamRunner.ts` + scheduler, persisted results                   |
| RBAC + workspaces                                               | 4-role hierarchy, workspace invitations, owner protection           |
| SSO (SAML + OIDC)                                               | Full implementation with JIT provisioning                           |
| Alert rules + Discord/PagerDuty                                 | 6 metrics, 4 severity levels, cooldowns                             |
| Data export (JSON/CSV/PDF)                                      | Streaming for large datasets                                        |
| API docs portal                                                 | OpenAPI 3.0.3 generator from live tRPC                              |
| GitHub Action (secret scan)                                     | Engine ready, needs App registration                                |
| Stripe billing scaffold                                         | Webhook verified, checkout session built                            |
| VS Code extension                                               | 14 source files, compiled clean                                     |
| YAML policy DSL                                                 | Parser + 5 production templates                                     |
| Encrypted vault                                                 | AES-256-GCM per-tenant                                              |
| Audit logs                                                      | Full trail across auth, billing, scans, admin actions               |

### ⚠️ PARTIAL — Exists but has known gaps

| Feature                         | Gap                                                                  |
| ------------------------------- | -------------------------------------------------------------------- | --- | ------------------------------------- |
| Prompt injection blocking       | 87 payloads (good), regex-only (no semantic), field is moving fast   |
| PII redaction                   | 12 rules, missing Aadhaar/PAN/GSTIN (critical for India-first pitch) |
| Shadow AI detection             | Works only if customers instrument their app — no agent/eBPF         |
| Security Copilot                | 6–10 deterministic intents, no LLM, no real follow-up handling       |
| MCP governance                  | Scaffolding good, enforcement loop incomplete                        |
| BullMQ queue                    | Abstraction built, but not all consumers migrated                    |
| Distributed Redis rate limiting | Per-process only — multi-instance not safe                           |
| DB transaction safety           | Missing atomic wrappers in several write paths                       |
| Frontend TypeScript             | `                                                                    |     | true` in CI = silently ignored errors |

### ❌ NOT DONE — Blocking for serious investor pitch

| Item                              | Status                                                   |
| --------------------------------- | -------------------------------------------------------- |
| Production deployment             | NOT deployed — no live URL                               |
| Brand domain                      | `rakshex.in` NOT purchased yet (in checklist, unchecked) |
| Landing page                      | NOT built                                                |
| VS Code Marketplace publish       | NOT done                                                 |
| NPM/PyPI SDK publish              | NOT done                                                 |
| GitHub App registration           | NOT done                                                 |
| Stripe live keys                  | NOT configured                                           |
| DPDP Act compliance docs          | NOT done                                                 |
| Privacy Policy / Terms of Service | Pages exist in frontend but content unknown              |
| Mobile responsiveness             | NOT confirmed                                            |
| SOC2 Type 1                       | 0% — calendar/paperwork process                          |

---

## Critical Issues to Fix Before Investor Pitch

### Priority 1 — Must fix in 48 hours

**1. Fix the CI `|| true` on frontend TypeScript**  
`cd rakshex-frontend && npm ci && npx tsc --noEmit || true` silently eats all frontend TS errors. Remove `|| true`. Fix whatever errors come up. An investor's technical advisor will catch this immediately and it signals sloppy engineering standards.

**2. Wire the missing routers**  
`server/routers/_app-update.ts` shows `cost`, `fix`, `github` routers are NOT in the main `appRouter`. Either wire them or delete the file. A dangling TODO file in the repo root is a mess.

**3. Add Indian PII rules**  
You're pitching as India-first. Aadhaar, PAN, GSTIN, IFSC, Indian mobile number regex are NOT in the PII redaction engine per your own MARKET_READINESS.md. This is a one-day fix and a massive credibility issue if missed.

**4. Add DB transaction wrappers on critical paths**  
At minimum: `collections.create` → scan queue → finding insert should be atomic. A failed partial write in production is a data integrity bug, not a feature gap.

### Priority 2 — Fix before the actual pitch meeting

**5. Deploy to a live URL**  
Railway.app or Fly.io. Free tier. You need a URL to demo, not a localhost. An investor cannot evaluate a product they can't open in a browser. This is a hard requirement.

**6. Buy rakshex.in + basic landing page**  
The domain is in your checklist and unchecked. ₹800/year on GoDaddy. Landing page can be a single HTML file. Do it today.

**7. Populate real test data for the demo**  
The demo flow matters more than the code. Prepare a scripted walkthrough: import a Postman collection → trigger a scan → show findings → show token cost → trigger red-team → show kill switch. Practice it 5 times.

**8. Fix the `|| true` in CI (again, this cannot be overstated)**  
If a technical investor or their CTO advisor looks at your CI YAML and sees this, the conversation about funding will change tone immediately.

### Priority 3 — Should address but not pitch-blocking

**9. AWS Bedrock provider**  
Enterprise customers on AWS will ask. "On roadmap, 1 week of engineering once you share your Bedrock account" is an acceptable answer.

**10. Semantic/ML prompt injection layer**  
87 regex payloads is good for a pitch. Just be honest: "We're building toward embedding-based detection for paraphrased attacks."

**11. MCP transport client**  
The scaffolding is real. "MCP governance is in private beta with early design partners" is a defensible pitch position if you don't overclaim.

---

## What Your Investors Will Actually Evaluate

### Technical due diligence checklist (what they check)

| Check                                      | Your Status                                       |
| ------------------------------------------ | ------------------------------------------------- |
| Does CI pass?                              | Server tests ✅, Frontend TS silently fails ⚠️    |
| Is there a live product URL?               | ❌ Not confirmed                                  |
| Is the schema coherent?                    | ✅ 1,412-line schema, 18 migrations               |
| Are there real tests?                      | ✅ 478+ server tests                              |
| Is there patent protection?                | ✅ 4 provisional patents (NHCE/DEV/2026/001–004)  |
| Is the team size realistic for this scope? | ⚠️ Solo founder + agents — will be asked          |
| Is there revenue/traction?                 | ❌ No paying customers yet                        |
| Is the market real?                        | ✅ API security + LLM governance is a hot segment |

### What you must NOT say in the pitch

- "We have 92% market readiness" — the MARKET_READINESS.md self-assessment. Investors will ask for evidence for every percentage point. Use honest language instead: "The core engine is production-grade. We're 3 paperwork tasks away from GA launch."
- Claim Bedrock/JetBrains/SOC2 are done when they're not.
- Claim the VS Code extension is on the Marketplace when it's not published.

### What you CAN credibly say

- "478+ passing server-side tests across all feature domains"
- "4 provisional patents filed at NHCE"
- "Full TypeScript codebase with tRPC, zero `as any`, pino structured logging, Helmet CSP"
- "SSO with SAML 2.0 + OIDC, RBAC with 4 roles, multi-tenant workspaces — enterprise-ready auth foundation"
- "India Blockchain Week 2025 Grand Finalist with WhisperCache"
- "18 database migrations — schema evolution documented, not just a prototype"
- "Self-hostable via Docker Compose, production Docker image included"

---

## Honest Completion Score by Layer

| Layer                     | Score | Notes                                                       |
| ------------------------- | ----- | ----------------------------------------------------------- |
| Core backend engine       | 88%   | Real, tested, production-quality                            |
| Database schema           | 85%   | Strong, missing FK constraints + transactions in some paths |
| Auth + security hardening | 82%   | Solid foundation, refresh token rotation still partial      |
| VS Code extension         | 70%   | Real code, not published                                    |
| Frontend (structure)      | 65%   | Many pages likely thin shells, TS errors silently ignored   |
| SDK (Node)                | 80%   | Real, not published to NPM                                  |
| GitHub Action             | 55%   | Engine ready, blocked on App registration                   |
| MCP governance            | 50%   | Scaffolding only                                            |
| Live product              | 0%    | Not deployed                                                |
| Brand + GTM               | 15%   | Domain not purchased, no landing page                       |

**Overall honest score: 72–76%** (not 92% as MARKET_READINESS.md claims — they counted paperwork tasks as "done" when they're blocked on you)

---

## The 7-Day Pre-Pitch Sprint Plan

| Day   | Task                                                             |
| ----- | ---------------------------------------------------------------- | --- | --------------------------------------- |
| Day 1 | Fix CI `                                                         |     | true`, wire missing routers, buy domain |
| Day 2 | Deploy to Railway/Fly.io, configure env vars                     |
| Day 3 | Add Indian PII rules (Aadhaar/PAN/GSTIN/IFSC)                    |
| Day 4 | Basic landing page at rakshex.in, pricing page                   |
| Day 5 | Prepare and record 5-minute demo video                           |
| Day 6 | Seed demo environment with realistic data, dry run pitch 3 times |
| Day 7 | Investor pitch ready                                             |

---

## Bottom Line

The codebase is real. Not a prototype. Not a demo. 452 files, 18 migrations, 478+ tests, 4 patents, full tRPC + Drizzle + MySQL stack. The architecture decisions are solid (typed errors, pino logging, Helmet CSP, CSRF protection, proper session management).

The gap between where you are and "pitch-ready" is not more code. It's deployment, a domain, a live URL, and fixing 3–4 specific technical hygiene issues that a technical investor will catch in 10 minutes of code review.

You spent ₹9.71 and 562M tokens on CommandCode to get here. The last 20% is your personal execution.

---

_Audit generated May 2026 | Based on full ZIP codebase review_
