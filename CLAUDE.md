# RaksHex — canonical engineering handoff

**Repository audit refreshed:** 2026-08-28

**Canonical naming:** use **RaksHex** in human-facing copy, `rakshex` for package/path/domain identifiers, and `RAKSHEX_*` for environment variables. The active repository tree and remote branch/tag names are normalized to this convention.

**Brand verification:** the 2026-08-28 cleanup scanned the complete active tracked text tree plus remote branch/tag refs for retired naming variants and passed with zero remaining matches.

Read this file before changing architecture or trusting an older readiness document. It is intentionally evidence-first: current source + the GitHub release gate outrank dated reports, old branch names, screenshots, and historical test counts.

## 1. Product thesis

RaksHex is an **AI Action Control Plane**. The strategic core is the Agent Firewall: authorize consequential autonomous actions **before execution**, narrow delegated authority, mediate credentials, and record the decision in a tamper-evident Action Ledger.

Canonical action path:

1. Agent proposes a semantic action such as `financial.refund`.
2. RaksHex resolves delegated authority/capability constraints.
3. Policy evaluates to `ALLOW` or `DENY`.
4. Credential mediation releases a credential only for an allowed action.
5. Action Ledger records the authorization evidence.

The repository also contains scanning, team AI governance, gateway budgets/kill switches, compliance evidence mapping, GitHub/VS Code developer surfaces, and Node/Python SDKs.

## 2. Product truth boundaries

These boundaries are intentional and must survive future UI/copy work:

- A RaksHex gateway kill switch controls **RaksHex-routed traffic**. Do not claim it universally disables provider traffic that bypasses RaksHex.
- Provider-native seat, spend-limit, usage, or entitlement operations are capability-specific. `NOT_IMPLEMENTED`, `NOT_CONFIGURED`, and `UNAVAILABLE` are valid honest states, not placeholders to hide with fake success.
- Compliance output is evidence/mapping support, **not certification**.
- Python `rakshex-agentguard` source includes `AgentGuardClient` and `AgentFirewallClient`, but the package is **not public on PyPI yet**.
- Billing code existing does not make paid GA operationally complete. Production keys, real payment exercises, tax/legal review, monitoring, and named operators remain external launch requirements.
- Do not add fake customer logos, fake usage counters, fake trust badges, or unverified benchmarks.

## 3. Runtime baseline

The repository declares and now tests against:

- Node.js **24.x**
- pnpm **10.32.1**
- PostgreSQL
- Redis + BullMQ
- Python SDK: Python **>=3.10**

Production API/worker/web Dockerfiles are Node 24 based. If a workflow, Dockerfile, setup guide, or cloud runtime uses a different major version, treat it as a release-blocking consistency bug until deliberately reconciled.

## 4. Release gate — evidence, not memory

Never quote a hard-coded historical test count as proof of readiness. For the exact commit being promoted, the GitHub **CI** workflow and independent **Security scan** must be green.

The CI release gate covers:

- `pnpm install --frozen-lockfile`
- format check
- lint
- type checking
- Node/package unit tests
- Python SDK tests on Python 3.10 and 3.12
- integration tests with PostgreSQL + Redis
- security-focused tests
- production build
- Docker API/worker builds
- PostgreSQL migration + backup/restore smoke
- Playwright smoke (health/login/Agent Firewall decision)
- production dependency audit
- Gitleaks secret scan
- CycloneDX SBOM
- Trivy high/critical container scan

Useful local equivalents:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:security
pnpm build
pnpm db:migrate
pnpm test:e2e:smoke

python -m pip install -e "packages/agentguard-python[dev]"
python -m pytest packages/agentguard-python/tests
```

## 5. Repository map

- `apps/api` — Express + tRPC API and gateway/enforcement paths
- `apps/web` — Next.js web product/marketing/dashboard
- `apps/worker` / API queue workers — asynchronous jobs
- `apps/vscode-extension` — VS Code developer surface
- `apps/cli` — CLI surface
- `packages/action-control` — Agent Firewall/delegated-authority core
- `packages/policy-engine` — canonical policy evaluator
- `packages/database` — PostgreSQL schema/migrations
- `packages/scanner-core` — deterministic scanning
- `packages/sdk` — Node SDK
- `packages/agentguard-python` — Python AgentGuard + AgentFirewall client
- `packages/compliance-engine` — evidence/report mapping
- `packages/mcp-security` — MCP security package

## 6. Critical secrets and fail-closed paths

`RAKSHEX_VAULT_KEY` is load-bearing for encrypted stored credentials. Production credential mediation/provider connector flows must not run with an improvised or missing vault key.

Other common production requirements include `DATABASE_URL`, `REDIS_URL`, a strong `JWT_SECRET`, correct frontend/origin configuration, and feature-specific provider/payment/email/monitoring secrets.

Do not expose server secrets through `NEXT_PUBLIC_*` variables.

Production queues are expected to fail when Redis is unavailable rather than silently becoming an in-memory production queue. Development/test mocks are acceptable only when clearly scoped to development/test.

## 7. Database migration invariant

`packages/database/src/migrate.ts` uses an explicit `MIGRATION_ORDER` over `packages/database/drizzle`.

The historical risk was: a new SQL file could exist but be omitted from the hard-coded order and therefore never apply. That risk is now covered by `packages/database/src/migrate.order.test.ts`, which compares every forward `.sql` file against `MIGRATION_ORDER`.

Use:

```bash
pnpm db:migrate
```

Do not replace the repository migration path with an ad-hoc production `drizzle-kit migrate` command without deliberately changing and testing the release process.

## 8. Policy-engine status

Dashboard-authored `policy_rules` do **not** need to serialize through the static policy-as-code `PolicyDocument` parser. The dashboard path flows through `apps/api/engines/policyEngine.ts` into `@rakshex/policy-engine`.

The adapter preserves legacy dashboard intent by mapping:

- action pattern
- active state
- deterministic priority/order
- threat-level constraints
- rule condition
- effect

Static YAML policy-as-code remains a separate input format. Do not reintroduce duplicate policy evaluators to "fix" an old handoff note.

## 9. Team-governance status

Provider capabilities are explicit in the team-governance capability catalog. Unsupported provider-native operations should continue returning structured unsupported states.

The usage summary contract supports bounded reporting windows with optional `since` and `until`; the service must enforce both boundaries and reject an inverted range.

Never infer universal team/person usage visibility from one provider adapter. The product must describe data confidence/source honestly (`verified`, `imported`, `estimated`, etc.).

## 10. Branch/PR consolidation rule

This repository has accumulated many historical branches. A branch being ahead of `main` does **not** mean it contains missing work.

Recent lineage already consolidated major old branches:

- OpenAI governance/responses/billing-receipt P0 work from old PRs/branches was consolidated into merged PR #136.
- Python Agent Firewall work from the earlier branch/PR was superseded by merged PR #143 on current main.
- Security fixes from the earlier private-beta branch were absorbed into the merged private-beta lock work.
- Public-route/docs/legal/homepage cleanup landed through the subsequent merged PRs before the current investor-beta pass.

Before merging any old branch:

1. compare it against current `main`,
2. identify unique commits/files,
3. check whether a newer merged PR superseded them,
4. cherry-pick only genuinely missing current work,
5. run the complete release gate again.

Do **not** merge all stale branches as a cleanup strategy.

## 11. Documentation precedence

Use this order when documents conflict:

1. current source code
2. green CI/Security workflows for the commit being discussed
3. this `CLAUDE.md`
4. root `README.md`
5. `LAUNCH_CHECKLIST.md`
6. architecture/security/deployment runbooks
7. dated audits, gap inventories, release-package snapshots, marketing files

Documents such as `docs/FEATURE_MATURITY.md`, `docs/GAP_INVENTORY.md`, `docs/LAUNCH_GAP_REGISTER.md`, older release binders, and old RaksHex-era scripts/docs are historical context unless explicitly refreshed to the current audit date. Do not use them alone as evidence that a feature is live.

## 12. Private-beta UI/website direction

Public investor path should tell one story:

**Homepage → Product → Agent Firewall Demo → Trust/Docs → Beta Request**

Positioning:

> **RaksHex — AI Action Control Plane**
>
> AI agents don't just generate. They act. Control what happens next.

UI quality requirements include mobile/no-horizontal-overflow behavior, meaningful empty/error/success/404 states, reduced-motion support, accurate metadata/social assets, truthful links, and no fake trust proof.

Do not add a pile of UI libraries. The existing Tailwind/Lucide/motion stack is sufficient; prefer small composable primitives and a controlled dependency surface.

## 13. External/operational work vs code work

Green repository CI means the commit passed the repository's automated release gates. It does **not** automatically prove external infrastructure is correctly configured.

External items must be verified in the target environment before calling them live, including as applicable:

- DNS/TLS for web/API/docs domains
- production database/Redis reachability and backup ownership
- production vault/JWT/provider secrets
- SMTP/email deliverability
- GitHub App credentials/webhook delivery
- payment-provider live-mode exercises
- monitoring/on-call ownership
- legal/tax/security review

For the 2026-08-28 consolidation, **Vercel production promotion is intentionally deferred**. Do not block repository consolidation on Vercel, but do not claim the newest web commit is live on the public domain until a later deployment verification proves it.

## 14. Definition of "done" for a repository consolidation

A consolidation is done only when:

- intended current code is on one review branch,
- known real code defects found during the audit are fixed,
- intentionally unsupported external capabilities remain honestly labeled rather than faked,
- stale canonical docs are corrected,
- all declared runtimes are consistent,
- the full final-head CI release gate is green,
- the independent final-head Security scan is green,
- the PR is merged to `main`, and
- `main` is rechecked after merge.

Anything after that is deployment/environment work and should be named as such.
