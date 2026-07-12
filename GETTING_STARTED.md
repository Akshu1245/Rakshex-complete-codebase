# Getting Started with Rakshex

## Prerequisites

- Node.js 20+
- pnpm 9+ (see root `packageManager`)
- Docker (PostgreSQL + Redis)

## Local development

```bash
pnpm install --frozen-lockfile
pnpm db:up
cp .env.example .env
# Required: DATABASE_URL, REDIS_URL, JWT_SECRET (long random string)
pnpm db:migrate
pnpm dev
```

Verify:

```bash
curl -s http://localhost:3000/api/health
pnpm smoke:test
```

## First scan (when API + web are up)

1. Register or log in via the web app.
2. Create/select a workspace.
3. Import a Postman collection or OpenAPI document.
4. Run a scan and open **Findings**.

## CLI

```bash
pnpm --filter @rakshex/cli exec -- --help
```

See [docs/CLI.md](docs/CLI.md).

## Docker full stack

```bash
export JWT_SECRET="replace-with-long-secret"
docker compose build
docker compose up -d
API_URL=http://localhost:3000 pnpm smoke:test
```

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
