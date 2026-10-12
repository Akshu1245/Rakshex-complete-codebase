# YC #13 — API Guardian: contract-diff MVP

Status: **beta source implementation**. This is the first narrow step toward self-maintaining APIs, **not** automatic repair.

## How to use from a TypeScript workspace consumer

```ts
import { diffOpenApiContracts } from "@rakshex/scanner-core";
const result = diffOpenApiContracts(oldOpenApiDocument, newOpenApiDocument);
if (result.breaking) console.log(result.changes);
console.log(result.scope); // Always display the scope limitation.
```

The function is pure and needs **no** network, API key, LLM credit, GitHub access, database or queue.

## Local CLI usage (beta)

Within a checked-out repository workspace, run:

```bash
pnpm --filter @rakshex/cli dev api diff old-openapi.yaml new-openapi.json --format json
```

This uses the existing TypeScript CLI runner; **the CLI package is still private and not yet a published, compiled npm binary**. An eventual `npx rakshex` command needs its own packaging/release verification.

The comparison reads only two local `.json`, `.yaml` or `.yml` OpenAPI 3.0/3.1 documents (maximum 5 MiB each), and never uploads them. `--format json` writes the report to standard output; the default terminal view lists detected changes and the partial-coverage warning.

Exit codes: **0** = no _supported_ breaking changes detected (not guaranteed compatible); **1** = supported breaking changes detected; **2** = usage, invalid documents or unsupported schema feature. Neither outcome edits source files, calls a provider API or opens a pull request.

For an end-to-end test, use `pnpm --filter @rakshex/cli test`. The detector does **not** resolve `$ref` graphs or provide comprehensive compatibility checking.

**Safety for CI use:** Check both specs into a trusted workspace or use trusted local files. A clean comparison is a partial signal only; do not use exit code 0 as an automatic migration or deployment approval.

## Currently detected

- Removed HTTP methods on previously supported paths
- New/strengthened required path, query, header or cookie parameters (by name + location)
- Request body changing from optional/missing to required
- Added newly required top-level properties in JSON request bodies
- Removed top-level properties in JSON HTTP 200 responses

The report is deterministic, sorted by old path and HTTP method, with no auto-edit behavior.

## Explicit non-goals / limitations

- The old and new documents must be OpenAPI 3.0/3.1 objects with `paths`.
- Neither external nor local `$ref` graphs are resolved; unsupported references on inspected paths throw errors instead of being falsely reported safe.
- Only top-level `application/json` request properties and status-200 response properties are covered.
- Missing comparison categories include response status removal, schema type changes, enum reductions, nested fields, auth requirements, media type changes, semantic constraints, SDK call-site impact, aliases, polymorphic schemas and vendor-specific extensions.
- No automatic vendor monitoring, GitHub code editing, test execution sandbox, PR creation or deployments.
- A result with `breaking: false` **does not prove backwards compatibility**. It only indicates no changes matching the currently implemented limited rules.
- Partial support should never be marketed as oasdiff-equivalent.

## Next increments

1. Evaluate maintained open-source `oasdiff` or `openapi-diff` for more comprehensive breaking-change coverage; compare license, runtime placement and rule compatibility before adding dependencies.
2. **Implemented as a beta CLI subcommand:** compare two local OpenAPI documents, report JSON or terminal output, and fail explicitly on unsupported schema features. Next: add more comprehensive fixtures and broader OpenAPI compatibility checks.
3. Once the detection signal is reliable, build vendor-watch ingestion and impacted customer call-site analysis.
4. Produce isolated, test-validated, **approval-only** migration PRs. Route consequential repository actions through the existing RaksHex Agent Firewall/Action Ledger.

Do not add a second service, another dashboard, or a 30-agent orchestration layer just for this detector.

## Acceptance checks

```bash
pnpm --filter @rakshex/scanner-core test
pnpm --filter @rakshex/scanner-core typecheck
```

The GitHub CI and security scan must pass on the exact PR head commit before merging. Local/CI results, when obtained, should be recorded separately; source existence alone is not proof of test success.

## Merge policy

This beta implementation must not run migration actions or declare an integration safe. Merge only after both the repository CI and independent Security scan complete successfully for the exact PR head SHA. Runtime and customer-facing workflows require separate integration testing.
