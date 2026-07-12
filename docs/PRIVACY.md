# Privacy

## Defaults

- AgentGuard SDK privacy mode defaults to **`metadata_only`**: no prompt/response bodies; optional hashes only.
- Provider API keys stay in the customer process; Rakshex keys are workspace credentials only.
- Structured API logs redact password, token, apiKey, authorization, cookie fields.

## Modes

| Mode             | Stores content   | Network telemetry |
| ---------------- | ---------------- | ----------------- |
| metadata_only    | hashes/metadata  | yes               |
| redacted_content | redacted text    | yes               |
| full_content     | redacted secrets | yes               |
| local_only       | offline queue    | no                |
| zero_retention   | none             | no                |

## Retention / deletion

- Standard retention windows are configurable (see `services/privacy/retention.ts`).
- Deletion workflows anonymize email/name-style fields rather than leaving PII in place.
- Compliance exports must not claim certification.

## Contact

Privacy requests: follow your deployment’s operator runbook (`docs/operations/PRIVACY_REQUEST_RUNBOOK.md` if present).
