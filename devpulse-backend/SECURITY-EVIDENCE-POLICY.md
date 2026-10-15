# Draft scan evidence boundary

Source text is not safe evidence. Both regex scanners emit `[REDACTED]` in the existing matched_text field, preserving rule ID, line and column. Inventory locations preserve line numbers but omit source snippets. Detection/scoring patterns are unchanged. The frontend can keep rendering the same string field; it will not receive the matched credential from these producers.

The shared redactor copies known source-bearing fields before scan/CI persistence and ORM result serialization. It covers JSON-encoded historical payloads without rewriting stored evidence. Full-scan responses also sanitize cache hits that predate this change. Security JSON exports reuse that serializer; CSV already selects summary columns. This does not erase old database rows, Redis values, logs, backups or prior exports. Any cleanup/retention/incident decision requires a separate operator review.

Fix suggestions use canonical detector metadata only. Client-supplied prose and original source are no longer sent to the model provider. This deliberately reduces source-specific suggestions; the endpoint remains available for generic remediation. Unknown rule IDs are ignored. No provider request was executed during this change; the regression test uses a local fake client. Provider-generated examples remain unverified, not production patches.

Relevant scan error logs now record error classes rather than exception bodies. SQLAlchemy hides bound parameters in engine logs/exceptions. This is not a comprehensive logging/DLP layer.

## Explicit limits and follow-ups

- The redactor covers named scan-schema source fields, not arbitrary prose, URL queries, user-defined titles or every free-form application field. Adopt a typed allowlisted finding DTO before adding new raw context fields. Do not claim universal secret detection or comprehensive historical cleanup.
- Main's legacy scan/CI routes have persistence signature mismatches. They currently fail before returning newly generated evidence. This PR does not silently fix those routes or change their authorization model.
- Legacy scan history/CI listing lack tenant authorization. Redaction does not make global metadata access acceptable. Require a separate scoped authorization repair and tests before launch.
- Standard validation errors, unrelated application logging, arbitrary submitted URLs, legacy SQLite backup code and other data classes require separate review. No raw production credentials or database records were accessed.
- The separate TypeScript LeakShield classification PR is not replaced by this Python boundary fix. Review both before integration.

Check: `python -B tests/test_security_evidence.py`. Nine synthetic-only tests fail on the unmodified baseline and pass after the change. They cover producers, full-scan/cache HTTP output, new SQLite scan/CI persistence, legacy history/JSON+CSV export reads without record mutation, sensitive failure logs/SQL parameters and the mocked model-provider boundary. Set `RAKSHEX_TEST_SOURCE` to the read-only baseline backend path to reproduce the old behavior. This is not production verification.
