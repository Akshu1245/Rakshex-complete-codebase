# Phase 2 release gates — deliberately NOT satisfied yet

- [ ] Browser-local scanner genuinely runs inside browser; upload can be blocked by browser devtools/network verification
- [ ] No-login JSON/YAML spec / Postman import; invalid input produces explicit errors
- [ ] JSON and Markdown export validated, raw secret values never appear in output
- [ ] CLI is built to executable JavaScript, `private: false` only when release audited; test clean install on Windows/Linux/macOS
- [ ] Checksummed release artifact + signature (cosign/GPG), verified from a fresh machine; npm provenance after trusted publishing configured
- [ ] Offline GitHub Action runs using a pinned CLI version, emits compliant SARIF, fails correctly on threshold; exercised in two unrelated repos
- [ ] crAPI and VAmPI static benchmark results published with reproducible inputs and honestly scoped metrics
- [ ] Five real developers can scan unassisted; at least four finish within 5 minutes
- [ ] Browser load measured against <=2 seconds target on stated device/network; zero AI credits for deterministic check

**Source limitations confirmed:** `apps/cli/package.json` is currently `private: true` and its binary targets TypeScript source, while the existing GitHub Action uses Docker + an authenticated hosted API. These block claiming a signed public CLI or an offline action today.
