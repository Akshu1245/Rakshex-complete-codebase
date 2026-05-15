# DevPulse GitHub Action

🔒 Scan API endpoints for OWASP vulnerabilities and LLM cost anomalies on every pull request.

## Features

- **Automatic Framework Detection** — Express, FastAPI, Flask, Django, NestJS, Go, Rust
- **OWASP Top 10 Scanning** — BOLA, Broken Authentication, Injection, etc.
- **LLM Cost Anomaly Detection** — Catch runaway reasoning token spend before merge
- **Shadow API Discovery** — Find endpoints not in your API inventory
- **Beautiful PR Comments** — Clean, actionable findings with severity badges
- **CI/CD Fail Conditions** — Block merge on Critical or High findings
- **Compliance Scoring** — PCI DSS and OWASP scores in every PR

## Quick Start

```yaml
name: DevPulse Security Scan
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devpulse/security-scan@v1
        with:
          api-key: ${{ secrets.DEVPULSE_API_KEY }}
          fail-on-critical: true
          post-comment: true
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | ✅ | — | Your DevPulse API key |
| `api-url` | ❌ | `https://api.devpulse.in` | DevPulse API base URL |
| `fail-on-critical` | ❌ | `true` | Fail workflow on Critical findings |
| `fail-on-high` | ❌ | `false` | Fail workflow on High findings |
| `scan-openapi` | ❌ | — | Path to OpenAPI spec file |
| `scan-postman` | ❌ | — | Path to Postman collection file |
| `post-comment` | ❌ | `true` | Post findings as PR comment |

## Advanced Usage

```yaml
- uses: devpulse/security-scan@v1
  with:
    api-key: ${{ secrets.DEVPULSE_API_KEY }}
    fail-on-critical: true
    fail-on-high: true
    scan-openapi: ./openapi.yaml
    scan-postman: ./collection.json
    post-comment: true
```

## Getting an API Key

1. Sign up at [devpulse.in](https://devpulse.in)
2. Go to Settings → API Keys
3. Generate a new key
4. Add to your repository secrets as `DEVPULSE_API_KEY`

## License

MIT © Rashi Technologies
