# Rakshex

AI agent and API security platform — monorepo for scanning, governance, AgentGuard telemetry, and control-plane tooling.

**Status:** Active development. Feature maturity is marked below. Passing automated checks does **not** by itself mean the product is market-ready; see [docs/market-readiness-audit.md](docs/market-readiness-audit.md).

## Feature maturity

| Area                                     | Status        | Notes                                              |
| ---------------------------------------- | ------------- | -------------------------------------------------- |
| Auth (email, sessions, OAuth PKCE, TOTP) | **Available** | Argon2id passwords; workspace RBAC                 |
| Workspaces / API keys / projects         | **Available** | Hashed keys; tenant isolation helpers              |
| Collection import + secure parse         | **Available** | YAML/JSON bomb limits                              |
| Scanner core (API + AI rules)            | **Available** | Deterministic rules in `@rakshex/scanner-core`     |
| Findings lifecycle                       | **Available** | Open → resolved / false positive / etc.            |
| Web dashboard                            | **Beta**      | Real backend wiring; UI polish ongoing             |
| CLI offline scan                         | **Available** | `@rakshex/cli`                                     |
| VS Code extension                        | **Beta**      | SecretStorage; scan workspace commands             |
| GitHub Action / App                      | **Beta**      | Needs live credentials for full CI path            |
| AgentGuard Node/Python SDKs              | **Available** | Metadata-only privacy by default                   |
| Gateway kill switch / enforcement        | **Beta**      | Redis + PG; unit-tested core                       |
| Policy-as-code                           | **Available** | YAML schema, dry-run, immutability                 |
| Pricing engine                           | **Available** | Versioned catalog; estimates labeled               |
| Billing (Stripe/Razorpay)                | **Beta**      | Abstraction + existing routers; live keys required |
| MCP security inventory                   | **Beta**      | Scan package + API governance                      |
| Compliance report mapping                | **Available** | Evidence-based; **not a certification**            |
| Observability (OTel, health)             | **Beta**      | Health/ready; secret redaction in logs             |

### Explicit non-claims

This repository does **not** claim:

- SOC 2 / ISO / GDPR / EU AI Act **certification** (mapping only)
- Patent status
- “Fully production-ready for every customer” without operator validation
- Exact test counts as a marketing metric
- Encryption or HSM features beyond what the code implements (verify in code)

## Stack

- **Monorepo:** pnpm + turbo
- **API:** Express + tRPC (`apps/api`)
- **Web:** Next.js (`apps/web`)
- **DB:** PostgreSQL (Drizzle)
- **Cache/queues:** Redis + BullMQ
- **Packages:** `packages/*` (scanner, policy, pricing, agentguard-sdk, …)

## Quick start (clean machine)

### Prerequisites

- Node.js **≥ 20**
- pnpm **≥ 9** (repo pins `packageManager`)
- Docker Desktop (Postgres + Redis)

### Steps

```bash
git clone <your-fork-or-remote>
cd DevPulse_Complete_Codebase   # or repo root name

pnpm install --frozen-lockfile

# Infrastructure
pnpm db:up
# equivalent: docker compose up -d postgres redis

cp .env.example .env
# Set at least: DATABASE_URL, JWT_SECRET (≥32 chars), REDIS_URL

pnpm db:migrate
pnpm dev
```

- API: `http://localhost:3000` (or configured `PORT`)
- Web: see `apps/web` dev script (often `http://localhost:3001`)
- Health: `GET /api/health` and `GET /api/health/ready`

### Full Docker stack

```bash
export JWT_SECRET="change-me-to-a-long-random-secret-value"
export POSTGRES_PASSWORD="rakshex"
docker compose build
docker compose up -d
pnpm smoke:test   # requires API reachable; set API_URL if needed
```

## Scripts (delivery gates)

| Command                            | Purpose                                  |
| ---------------------------------- | ---------------------------------------- |
| `pnpm install --frozen-lockfile`   | Reproducible install                     |
| `pnpm format:check`                | Prettier on source/docs                  |
| `pnpm lint`                        | ESLint (packages + api/cli/worker)       |
| `pnpm typecheck`                   | Package typecheck                        |
| `pnpm test`                        | Unit tests (packages)                    |
| `pnpm test:integration`            | Integration-oriented API + DB tests      |
| `pnpm test:security`               | Authz, kill-switch, privacy, parse bombs |
| `pnpm build`                       | Package builds                           |
| `pnpm test:e2e`                    | Playwright smoke (`Smoke` tag)           |
| `pnpm smoke:test`                  | Live HTTP health against running API     |
| `pnpm db:backup` / restore scripts | Postgres dump + restore verification     |

CI stages: install → format → lint → typecheck → unit → integration → security → build → docker → migration → e2e → audit → secret scan → SBOM → container scan. **Failures block release.**

## Documentation

| Doc                                                              | Description                               |
| ---------------------------------------------------------------- | ----------------------------------------- |
| [GETTING_STARTED.md](GETTING_STARTED.md)                         | Local setup                               |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)                         | Staging, rollback, versioning             |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                     | System architecture                       |
| [docs/SECURITY.md](docs/SECURITY.md)                             | Security posture                          |
| [docs/PRIVACY.md](docs/PRIVACY.md)                               | Privacy / retention                       |
| [docs/API.md](docs/API.md)                                       | API overview                              |
| [docs/CLI.md](docs/CLI.md)                                       | CLI                                       |
| [docs/EXTENSION.md](docs/EXTENSION.md)                           | VS Code extension                         |
| [docs/SDK.md](docs/SDK.md)                                       | AgentGuard SDKs                           |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)               | Common failures                           |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)           | Release gate checklist                    |
| [docs/FEATURE_MATURITY.md](docs/FEATURE_MATURITY.md)             | Available / Beta / Experimental / Planned |
| [docs/market-readiness-audit.md](docs/market-readiness-audit.md) | Audit findings                            |

SDK package READMEs: `packages/agentguard-sdk`, `packages/agentguard-python`.

## Security contact

See `apps/web/public/.well-known/security.txt` and [docs/SECURITY.md](docs/SECURITY.md).

## License

See [LICENSE](LICENSE).
