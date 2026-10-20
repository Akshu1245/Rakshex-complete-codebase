# Scanner limitations

Rakshex deterministic scanner (`@rakshex/scanner-core`) is **static** and **rule-based**.

## What it does

- Parses Postman / OpenAPI-like documents already loaded in memory
- Emits findings only when evidence supports a match
- Labels confidence: `confirmed | high | potential | informational`
- Produces stable fingerprints for dedup and baselines
- Never calls external AI services for rule evaluation

## What it does not do

- Runtime traffic interception or active exploitation
- Authenticated API fuzzing or live SSRF probing
- Full OpenAPI `$ref` graph resolution (external refs are blocked at import)
- Guaranteed zero false positives — many rules are **potential** indicators
- Secrets vaulting (import redaction is best-effort pattern matching)
- Dynamic prompt-injection payload testing (separate optional path)

## Determinism

Given the same normalized collection and rule set version, `runScan` produces the same fingerprints and findings. Order is severity-sorted; timestamps are not part of the finding identity.

## Malformed input

Unknown or empty documents yield zero findings (no crash). Invalid structures should be rejected at the import layer before scanning.
