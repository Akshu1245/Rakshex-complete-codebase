# `@rakshex/scanner-core`

Deterministic API (and soon AI/agent) security scanner used by the Rakshex API, CLI, and GitHub Action.

## Design

- **Rules are pure** — no I/O, no LLM calls
- **Evidence required** — every finding includes `evidence[]`
- **Confidence labels** — collection rules: `confirmed | high | potential | informational`. Secret scanning (`secrets.ts`) uses state `pattern_match | likely_secret` (+ `verified_valid`, never set: no verifier exists), confidence `low | medium | high`, and a separate severity. A regex match is never "confirmed".
- **Stable fingerprints** — `ruleId|METHOD|path` for dedup / baseline

## Usage

```ts
import { runScan, listRuleIds } from "@rakshex/scanner-core";

const result = runScan(postmanOrOpenApiDocument);
console.log(result.findings, listRuleIds());
```

## Tests

```bash
pnpm test:scanner
```

## Rule IDs

### API

| ID                            | Severity        |
| ----------------------------- | --------------- |
| `api.insecure_http`           | High            |
| `api.missing_authentication`  | Critical / High |
| `api.idor_sequential_id`      | Medium          |
| `api.sensitive_data_in_query` | High            |
| `api.debug_headers`           | Low             |
| `api.missing_correlation_id`  | Low             |
| `api.ssrf_risk_indicator`     | Medium          |

### AI / agent

| ID                            | Severity  |
| ----------------------------- | --------- |
| `ai.prompt_injection_surface` | High      |
| `ai.excessive_agency`         | High/Crit |
| `ai.insecure_plugin_output`   | Medium    |

See [LIMITATIONS.md](./LIMITATIONS.md).
