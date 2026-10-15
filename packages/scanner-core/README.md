# `@rakshex/scanner-core`

Deterministic API (and soon AI/agent) security scanner used by the Rakshex API, CLI, and GitHub Action.

## Design

- **Rules are pure** — no I/O, no LLM calls
- **Evidence required** — every finding includes `evidence[]`
- **Confidence labels**: collection rules use `confirmed | high | potential | informational`.
- **Secret findings** (`secrets.ts`):
  - Each finding carries separate `detection_confidence` (low / medium / high), `potential_impact` (impact if real), `verification_status` (always `not_verified`: no authorized verifier exists, and values are never sent anywhere) and `classification`:
    - `known_dummy`: exact SHA-256 match of a published docs dummy.
    - `synthetic_placeholder`: the value itself is synthetic (repeated, periodic, template, sequence, or no random content left).
    - `ambiguous`: weak randomness. Shown, one step below impact.
    - `plausible_credential`: full impact.
  - Substrings such as "example"/"test", test paths and comments are recorded as signals and **never exempt** a finding.
  - CI gate: `rakshex secrets` fails on `failOn` severities (default Critical, High; `.rakshex/secrets-policy.json`). It passes only if a reviewed entry in `.rakshex/secrets-allowlist.json` covers the finding. An entry needs: an exact value hash or a rule+path+line fingerprint, a justification, an owner, a reviewer, and an expiry no more than 365 days after creation. Expired entries are ignored.
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
