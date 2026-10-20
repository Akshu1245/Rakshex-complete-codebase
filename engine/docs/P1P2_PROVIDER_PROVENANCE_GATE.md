# P1/P2 source provenance gate

Status: **synthetic-only local testing**. The offline `change-event.v1` bridge now rejects any event with `source_type: "provider"`, even if the input's before/after OpenAPI files match the event's SHA-256 values. An attacker can generate two specs and corresponding hashes; those hashes **do not prove the event originated with an API provider**.

Current output sets `event_source: "synthetic"` and `provider_authenticated: false`. `spec_hashes_verified: true` means only that the two *supplied local documents* matched their provided hash digests.

## Requirements to enable real provider events

1. Define one versioned event-envelope contract with provider ID, account/tenant, source URL or authorized connection ID, delivery ID, issued-at time, expiry, and a digest for both specs.
2. Verify origin with an authenticated provider integration (signed webhook with raw-byte signature verification or a trusted pull from the provider's API). Do **not** trust self-declared `source_type`, URL, account metadata, or spec hashes alone.
3. Bind the event to the authorized RaksHex workspace/provider connection; enforce delivery replay prevention and origin freshness, with fail-closed behavior when state storage is unavailable.
4. Pin the fetched upstream spec to a known trusted source and validate redirects, host allowlists, TLS identity, and network restrictions before comparing.
5. Keep provenance and privacy-safe output separate from customer source; never promote candidates directly into automatic changes or merges.
6. Add negative tests: forged provider claim, replay, invalid signature, wrong tenant, expired event, malicious redirect, and mismatched spec digest.

**This change does not authenticate providers or enable live detection.** Do not label synthetic demos as production monitoring.
