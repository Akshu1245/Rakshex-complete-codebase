# Part B — Market Differentiators & Part C — Release Gates

Source of truth for “market-ready” claims. Do not call the product market-ready until **every Part C gate is green**.

---

## Part B — Differentiator status

| Differentiator                | Status       | Primary code                                                   | Gap to “real”                                    |
| ----------------------------- | ------------ | -------------------------------------------------------------- | ------------------------------------------------ |
| Agent execution graph         | **Shipping** | `packages/agent-graph`, `server/services/agentOrchestrator.ts` | Persist runs to DB; UI graph view                |
| Agent run replay              | **Shipping** | `packages/agent-graph` (replay from event log)                 | Wire to stored agent steps / LLM requests        |
| Security simulation           | **Partial**  | `server/utils/promptInjectionPayloads.ts`, red-team runner     | Dedicated sim mode in product UI                 |
| MCP gateway                   | **Partial**  | `server/services/mcpInvocationGateway.ts`                      | Fail-closed defaults + full tool allowlist tests |
| Runtime DLP                   | **Partial**  | `server/engines/piiDetector.ts`, `piiRedaction.ts`, policy DSL | Enforce in gateway path with unit + e2e tests    |
| AI asset inventory            | **Partial**  | control-plane discovery, MCP discovery                         | Unified inventory API + ownership fields         |
| Policy-as-code                | **Shipping** | `packages/policy-engine` + `server/services/policyDsl.ts`      | Versioned draft/publish + dry-run UI             |
| Cross-provider cost optimizer | **Partial**  | token analytics, forecasting, copilot intents                  | Actionable recs package with savings estimates   |
| Framework-aware auto-fix      | **Partial**  | `server/services/autofix.ts`                                   | Map scanner-core rule IDs; Express/FastAPI/etc.  |
| Risk baseline + regression    | **Shipping** | `packages/risk-baseline`                                       | Persist baselines per workspace/collection       |
| Shadow AI discovery           | **Partial**  | `server/services/shadowAi.ts`, ingest API                      | Dashboard + allowlist UX polish                  |
| AI red-team benchmark suite   | **Partial**  | `redTeamRunner.ts`, `redTeamScheduler.ts`, payloads            | Scoreboard + regression vs last run              |
| Customer SIEM export          | **Shipping** | `packages/siem-export` (+ tabular `dataExport.ts`)             | Wire export API + redaction before ship          |
| Self-hosted enterprise deploy | **Partial**  | Docker compose, Dockerfiles                                    | Helm/docs + offline image pack                   |
| Human approval workflows      | **Partial**  | `server/api/approvals.ts`, policy enforcement                  | Approve/reject must unblock gateway queue        |

Legend: **Shipping** = new package with tests in this pass. **Partial** = exists but incomplete for market-ready bar.

---

## Part C — Release requirements (gates)

| #   | Gate                              | How we verify                                  | Owner path                                |
| --- | --------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| 1   | All packages build                | `pnpm run check:packages` + root `build`       | CI                                        |
| 2   | Strict TS zero errors             | Strict packages first; root strict = follow-up | `tsconfig.base.json` packages             |
| 3   | No critical placeholder routes    | Code review + `demo` feature-flag only         | `server/api/demo.ts`                      |
| 4   | No fake data on prod screens      | Feature flags; no hardcoded findings           | Frontend + API                            |
| 5   | Release CI no ignored failures    | No `continue-on-error` on release jobs         | `.github/workflows/ci.yml`                |
| 6   | Tenant isolation tests            | Automated                                      | `server/services/tenantIsolation.test.ts` |
| 7   | Auth security tests               | Automated                                      | existing oauth/cookies/logout tests       |
| 8   | Upload security tests             | Automated                                      | collection import tests                   |
| 9   | Scanner deterministic rule tests  | Automated                                      | `packages/scanner-core`                   |
| 10  | GitHub integration e2e            | Playwright / integration                       | `github-action/`, `server/api/github.ts`  |
| 11  | VS Code integration e2e           | Extension tests                                | `devpulse-vscode`                         |
| 12  | Kill switch runtime enforced      | Unit + gateway tests                           | kill switch + gateway policy              |
| 13  | Billing webhooks verified         | Stripe signature tests                         | `server/stripe.ts`                        |
| 14  | Backups / restore tested          | Runbook + script                               | docs + scripts                            |
| 15  | Docs match reality                | Manual checklist                               | README / GETTING_STARTED                  |
| 16  | No secrets in git history         | `gitleaks` / secret scan workflow              | `security-scan.yml`                       |
| 17  | No critical/high exploitable deps | `pnpm audit` / Dependabot                      | CI                                        |

**Local gate runner:** `pnpm run release:gates` (scripts/release-gates.mjs)

---

## Market-ready decision rule

```
MARKET_READY = ALL(Part C gates green) AND
               Part B differentiators either Shipping or explicitly
               marked "beta / feature-flagged" in product UI
```

Never claim full coverage for a Part B item that is Partial without a flag.
