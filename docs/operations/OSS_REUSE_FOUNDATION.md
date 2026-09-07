# OSS reuse foundation

RaksHex keeps its differentiated runtime authority in-house and reuses mature OSS only for supporting infrastructure.

## RaksHex-owned core

- cross-provider pre-spend reservation and settlement semantics
- identity/economic attribution graph
- runtime policy decision semantics and evidence
- canonical cost/audit truth

## Reused infrastructure

- Portkey Models: upstream price candidates; never queried on the runtime request path
- k6: external load generation
- Semgrep CE: SAST baseline in CI
- Testcontainers/Toxiproxy: deterministic dependency/network failure testing (next slice)
- OpenTelemetry: existing tracing/metrics; extend with GenAI + RaksHex financial conventions

## Safety rules

1. OSS pricing data is imported as a source candidate, validated, versioned and stored locally before runtime use.
2. Runtime money-path logic never depends on a live third-party OSS service.
3. Provider retries are not enabled until request idempotency is proven for the corresponding economic path.
4. Probabilistic prompt/PII classifiers are advisory signals unless a workspace explicitly configures them as enforcement inputs.
5. Licenses and pinned versions are reviewed before production embedding.
