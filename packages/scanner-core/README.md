# `@rakshex/scanner-core`

Deterministic API (and soon AI/agent) security scanner used by the Rakshex API, CLI, and GitHub Action.

## Design

- **Rules are pure** — no I/O, no LLM calls
- **Evidence required** — every finding includes `evidence[]`
- **Confidence labels** — `confirmed | high | potential | informational`
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

## Rule IDs (v0.1)

| ID                            | Severity        |
| ----------------------------- | --------------- |
| `api.insecure_http`           | High            |
| `api.missing_authentication`  | Critical / High |
| `api.idor_sequential_id`      | Medium          |
| `api.sensitive_data_in_query` | High            |
| `api.debug_headers`           | Low             |
| `api.missing_correlation_id`  | Low             |
| `api.ssrf_risk_indicator`     | Medium          |
