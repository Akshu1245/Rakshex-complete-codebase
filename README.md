# RaksHex

**AI Action Control Plane for autonomous software.** RaksHex authorizes consequential agent actions before execution, narrows delegated authority, mediates credentials, and records decisions in a tamper-evident Action Ledger.

> **Private beta.** This repository contains working product code and release gates, but it does not claim certification, universal provider coverage, or paid-GA readiness. Read [`CLAUDE.md`](CLAUDE.md) for the current engineering handoff and [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) for the evidence-based launch gate.

## Strategic core

The Agent Firewall path is the product thesis:

1. An agent proposes a semantic action such as `financial.refund`.
2. RaksHex validates delegated authority and policy.
3. The decision is `ALLOW` or `DENY` before the action executes.
4. Credential mediation releases a credential only when the decision permits it.
5. The Action Ledger records the authorization evidence.

The repository also contains API/secret scanning, team AI governance, gateway budgets and kill switches, compliance evidence mapping, a VS Code extension, Node SDKs, and a Python SDK.

## What is actually available in source

| Surface                                 | Current status                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Agent Firewall authorization            | Available and covered by API/E2E tests                                                                                                  |
| Delegated authority / attenuation       | Available in `@rakshex/action-control`                                                                                                  |
| Credential mediation                    | Available for the enforced broker path                                                                                                  |
| Action Ledger                           | Available; tamper-evident/hash-chained records                                                                                          |
| Enforcement gateway providers           | OpenAI, Azure OpenAI, OpenRouter, and Anthropic for RaksHex-routed traffic; see `docs/GATEWAY_PROVIDERS.md`                             |
| Gateway budgets and kill switches       | Available; enforcement applies to RaksHex-routed traffic                                                                                |
| Scanner core / collection import        | Available                                                                                                                               |
| GitHub scanning path                    | Available when the GitHub App is configured                                                                                             |
| VS Code extension                       | Available in source and Marketplace workflow                                                                                            |
| Node SDK                                | Available in source                                                                                                                     |
| Python AgentGuard + AgentFirewallClient | Available in source; **not published on PyPI yet**                                                                                      |
| Team governance provider connectors     | Capability-dependent; unsupported provider-native operations remain explicitly `NOT_IMPLEMENTED`/`NOT_CONFIGURED` rather than simulated |
| Compliance                              | Evidence mapping only; **not certification**                                                                                            |
| Paid billing                            | Code paths exist; live launch still requires production credentials and real payment exercises                                          |

## Non-claims

RaksHex does **not** claim:

- SOC 2, ISO 27001, GDPR, EU AI Act, PCI, or other certification from repository code alone.
- Patent status.
- A hard kill switch for provider traffic that bypasses the RaksHex enforcement path.
- Provider-native seat/budget controls where the provider capability catalog says they are unavailable or not implemented.
- Public PyPI availability for the Python SDK.
- Paid public launch without production payment, legal, security, and operator sign-off.

## Repository stack

- **Runtime:** Node.js **24.x**
- **Package manager:** pnpm **10.32.1**
- **Monorepo:** Turborepo
- **API:** Express + tRPC (`apps/api`)
- **Web:** Next.js (`apps/web`)
- **Database:** PostgreSQL + Drizzle
- **Cache/queues:** Redis + BullMQ
- **Python SDK:** Python **>=3.10** (`packages/agentguard-python`)

## Clean-machine setup

```bash
git clone https://github.com/Akshu1245/Rakshex-complete-codebase.git
cd Rakshex-complete-codebase

corepack enable
pnpm install --frozen-lockfile
pnpm db:up

cp .env.example .env
# Set at minimum for local enforced flows:
# DATABASE_URL
# REDIS_URL
# JWT_SECRET (>=32 chars)
# RAKSHEX_VAULT_KEY (>=32 chars)

pnpm db:migrate
pnpm dev
```

Typical local endpoints:

- API: `http://localhost:3000`
- Web: `http://localhost:3001`
- Health: `GET /api/health` and `GET /api/health/ready`

## Release gates

The GitHub CI release gate runs reproducible install, formatting, lint, type checking, Node/package tests, Python SDK tests on Python 3.10 and 3.12, integration tests, security tests, production build, PostgreSQL migration/restore verification, Docker builds, Playwright smoke, dependency audit, secret scan, SBOM generation, and Trivy container scanning.

Useful local commands:

```bash
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

Do not describe a commit as release-ready unless the **Release gate** and independent **Security scan** are green on that commit.

## Documentation order

1. [`CLAUDE.md`](CLAUDE.md) — current engineering handoff, architecture boundaries, verified gaps.
2. [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) — current private-beta launch gate.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture.
4. [`docs/SECURITY.md`](docs/SECURITY.md) — security posture.
5. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deployment mechanics and rollback.
6. [`docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md) — operator deployment runbook.
7. [`packages/agentguard-python/README.md`](packages/agentguard-python/README.md) — Python SDK, including the Agent Firewall client.

Older dated audits, launch-gap inventories, and release-package documents are historical snapshots unless they explicitly say otherwise. Current source, current CI, `CLAUDE.md`, and this README take precedence.

## Security contact

See `apps/web/public/.well-known/security.txt` and [`docs/SECURITY.md`](docs/SECURITY.md).

## License

See [`LICENSE`](LICENSE).
