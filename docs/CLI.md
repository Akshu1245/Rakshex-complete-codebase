# CLI

Package: `apps/cli` (`@rakshex/cli`).

## Commands (high level)

- `login` / `configure` — credentials and endpoint
- `scan` — local/offline or remote scan; outputs `json` / `sarif` / terminal
- `policy` — policy helpers
- `report` — report export
- `doctor` — environment diagnostics
- `rules` — list scanner rules

## Usage

```bash
pnpm --filter @rakshex/cli exec node dist/index.js --help
# or during dev:
pnpm --filter @rakshex/cli dev
```

Exit codes distinguish clean, findings-present, and hard failures (see CLI tests).
