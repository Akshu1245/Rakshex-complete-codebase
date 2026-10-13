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

## Extended detection with oasdiff (optional, offline)

For broader OpenAPI compatibility detection, RaksHex can invoke the maintained [oasdiff](https://github.com/oasdiff/oasdiff) command-line tool as an **opt-in engine**. Install a trusted oasdiff binary and add it to your PATH. Windows, Linux and macOS builds are available from the [official releases](https://github.com/oasdiff/oasdiff/releases). The CI smoke test pins version `v1.29.1`; for reproducibility, use that version locally too.

```bash
pnpm --filter @rakshex/cli dev api diff old.yaml new.yaml --engine oasdiff --format json
```

This invokes `oasdiff breaking --format json --fail-on WARN --allow-external-refs=false -- <local-old-file> <local-new-file>`. The `--` separator prevents file paths from being interpreted as flags. Remote and external `$ref` loading is disabled explicitly to reduce SSRF/file-import exposure from untrusted documents. Both inputs remain **local files only**, with a 5 MiB limit each; the command makes no RaksHex cloud request. The adapter uses a fixed subprocess argument array, no shell, a 30-second timeout and capped output; unexpected engine output or exit codes become exit 2 instead of a false-clean report. Do not use `--open` with confidential specs: it is not supported by this adapter.

The default `--engine basic` keeps the original narrow deterministic scanner. The extended `oasdiff` report exposes stable `id`, `level`, operation/path and summary text. Exit code 1 means ERR/WARN-level changes were found, which include _possible_ rather than only proven breaking changes. Exit 0 means none were reported **by that tool**—not verified runtime compatibility. If the external executable is absent or reports an unexpected result, exit code 2 is returned; there is no silent fallback to the basic engine.

The new fixture in `apps/cli/fixtures/api-contracts/` demonstrates `$ref`-backed response schema evolution, nested property removal and response type changes. The Docker CI job calls a pinned oasdiff release on these local fixtures; RaksHex CLI unit tests also verify safe subprocess invocation and errors.

The oasdiff package is Apache-2.0 licensed and remains a separate local tool; the RaksHex package doesn't embed or redistribute its binary.

## Static source impact candidates (YC #13 beta)

RaksHex can now correlate detected API contract changes with **candidate** TypeScript/JavaScript HTTP call sites in a local source directory, without uploading customer code:

```bash
pnpm --filter @rakshex/cli dev api diff old.yaml new.yaml --engine oasdiff --impact-dir ./src --format json
```

This adds an `impact` object to the existing JSON report. It includes file-relative paths, 1-based line/column numbers, matched HTTP method/path, candidate rule ID, and coverage counts. Existing `api diff` JSON output remains unchanged when `--impact-dir` is omitted. Basic and optional oasdiff modes both support the flag.

The initial TypeScript compiler AST matcher finds direct `fetch(...)`, `globalThis.fetch(...)`, and `axios` calls with static paths, including single-segment template interpolations. It recognizes literal methods, standard Axios HTTP verbs, Axios default-import aliases, path parameters, and query strings.

**This is a candidate finder, not a verified dependency graph.** It does **not** resolve custom API clients created with `axios.create`, named/re-exported wrappers, arbitrary URL builders, SDK usage, import graphs, base-URL configuration, provider identity, response field dataflow or runtime behavior. Multiple APIs can share the same method/path; each match is therefore marked `confidence: "candidate"`. The report counts dynamic/unlocatable calls and change rules lacking matches. **Zero candidates is never proof that no code will break.**

The scan is bounded (3,000 source files, maximum 1 MiB per file and 32 MiB total, depth 20), skips dependencies/build folders, and does not follow symlinks. It prints source locations, not source snippets. Exceeding resource limits or failing to read a directory returns exit 2 rather than a misleading clean report. No files are modified and no pull requests are opened.

Exit codes continue to reflect **contract differences**, not impact findings: 0 = no supported breaking contract rules detected, 1 = breaking contract rules detected, 2 = invalid/unsupported comparison or impact analysis failure.

## Currently detected

- Removed HTTP methods on previously supported paths
- New/strengthened required path, query, header or cookie parameters (by name + location)
- Request body changing from optional/missing to required
- Added newly required top-level properties in JSON request bodies
- Removed top-level properties in JSON HTTP 200 responses

The report is deterministic, sorted by old path and HTTP method, with no auto-edit behavior.

## Explicit non-goals / limitations

- The old and new documents must be OpenAPI 3.0/3.1 objects with `paths`.
- The **basic** engine does not resolve local or external `$ref` graphs; unsupported references on inspected paths throw errors. The optional oasdiff engine supports local `$ref`s, with external references disabled for untrusted input.
- Only top-level `application/json` request properties and status-200 response properties are covered.
- In the **basic** engine, missing comparison categories include response status removal, schema type changes, enum reductions, nested fields, auth requirements, media type changes, semantic constraints, SDK call-site impact, aliases, polymorphic schemas and vendor-specific extensions. The optional oasdiff engine expands coverage but doesn't guarantee exhaustive compatibility.
- No automatic vendor monitoring, GitHub code editing, test execution sandbox, PR creation or deployments.
- A result with `breaking: false` **does not prove backwards compatibility**. It only indicates no changes matching the currently implemented limited rules.
- Partial support should never be marketed as oasdiff-equivalent.

## Next increments

1. **Implemented as an optional adapter:** use the Apache-2.0 oasdiff binary locally for broader breaking-change detection; validate version, output and false-positive/false-negative behavior against customer fixtures before making it the default.
2. **Implemented as a beta CLI subcommand:** compare two local OpenAPI documents, report JSON or terminal output, and fail explicitly on unsupported schema features. Next: add more comprehensive fixtures and broader OpenAPI compatibility checks.
3. **Initial static impact mapping implemented:** bounded local AST-based fetch/Axios candidate detection. Next extend SDK/client coverage and add vendor-watch ingestion with explicit provider identity.
4. Produce isolated, test-validated, **approval-only** migration PRs. Route consequential repository actions through the existing RaksHex Agent Firewall/Action Ledger.

Do not add a second service, another dashboard, or a 30-agent orchestration layer just for this detector.

## Acceptance checks

```bash
pnpm --filter @rakshex/scanner-core test
pnpm --filter @rakshex/scanner-core typecheck
pnpm --filter @rakshex/cli test
```

The GitHub CI and security scan must pass on the exact PR head commit before merging. Local/CI results, when obtained, should be recorded separately; source existence alone is not proof of test success.

## Merge policy

This beta implementation must not run migration actions or declare an integration safe. Merge only after both the repository CI and independent Security scan complete successfully for the exact PR head SHA. Runtime and customer-facing workflows require separate integration testing.
