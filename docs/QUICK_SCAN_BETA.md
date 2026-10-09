# RaksHex Quick Scan — beta implementation

## Scope

This UI uses `packages/scanner-core/src/browser.ts` and the existing deterministic `runScan` engine, in the browser tab. A file or pasted text is parsed locally using the existing `yaml` dependency. The page does not send the specification to an API, scrape an API, or spend AI credits. It supports local OpenAPI JSON/YAML and Postman JSON **documents**, not arbitrary source-code projects or runtime vulnerability verification. All findings are potential static indicators unless independently confirmed.

URL fetching has been removed **from the browser UI**. The existing Express `/api/public/quick-scan` endpoint remains present for compatibility and needs a separate SSRF/security review before use. This patch does not remove it or disable it.

The Quick Scan route is still rendered by the existing Next.js app and global app layout; it is **not yet independently hosted as a static Cloudflare Pages site**. That deployment step is deliberately deferred.

## Preview

- Open `/quick-scan` without logging in.
- Drop a `.json`, `.yaml` or `.yml` file <= 5 MiB, or paste a document.
- Click **Run local scan**. The rule engine and YAML parser are loaded only when scanning.
- Filter findings and download JSON or Markdown reports.
- Invalid and empty documents fail visibly instead of being reported clean.

## CLI changes

- `--baseline` creates the baseline if none exists, then **compares without modifying it** on future runs. To regenerate, explicitly remove/rename `~/.rakshex/baseline.json` after saving a backup. Production CI should not create a new baseline automatically; provision the baseline first.
- `--fail-on <Critical|High|Medium|Low|none>` overrides the per-user saved severity threshold for one run. A missing/malformed value fails with code 2.
- Directory scan discovery is limited to likely OpenAPI/Postman file names to avoid failing on unrelated `package.json`/YAML config files; scan any custom-named file explicitly.

## GitHub Action (beta)

The **new** `github-action/offline/action.yml` is a composite action for a single repo-relative spec file. It downloads dependencies from npm/GitHub on the runner but **does not require or contact a RaksHex API** and requires no RaksHex secret. It generates `rakshex-results.sarif`. It is a _different action_ from the preexisting Docker-based `github-action/action.yml`; neither has been published to an Action marketplace or validated in two external repos.

Consumer workflow example **after merging**, replacing `<FULL_COMMIT_SHA>` with an immutable commit SHA:

```yaml
name: API specification security
on: [pull_request]
permissions:
  contents: read
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: scan
        uses: Akshu1245/Rakshex-complete-codebase/github-action/offline@<FULL_COMMIT_SHA>
        with:
          file: spec/openapi.yaml
          fail-on: High
```

GitHub Code Scanning upload can be added only after a permissions and SARIF location compatibility test. Current SARIF can contain API endpoint locations rather than real source file lines; treat the SARIF file as beta output, **not verified GitHub annotations**.

## Required verification before saying launched

1. `pnpm install --frozen-lockfile` from a clean Node 24 checkout.
2. `pnpm --filter @rakshex/scanner-core test` and `pnpm --filter @rakshex/web test`.
3. `pnpm --filter @rakshex/web typecheck` and `pnpm --filter @rakshex/web build`.
4. `pnpm --filter @rakshex/cli test`, typecheck, and CLI exit-code tests.
5. Browser devtools network check showing no file/spec POST or RaksHex API call during `/quick-scan` interaction. Check global analytics scripts separately.
6. Browser behavior on mobile and desktop; files at 5 MiB; reject malformed YAML; verify JSON and Markdown reports.
7. Action runs in at least two separate real GitHub repositories, one clean and one with policy findings.
8. Run known-vulnerable API spec benchmarks following `docs/SCANNER_ACCURACY_PROTOCOL.md`; collect five developer usability sessions and document measurements.

> Keep RaksHex **beta**, not production-ready, until the release gates and live user/security checks pass.
