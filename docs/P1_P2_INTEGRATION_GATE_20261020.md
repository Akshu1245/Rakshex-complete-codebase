# P1/P2 integration gate — 2026-10-20

This branch starts from `integration/self-repair-engine`. It is **not merge-ready**.

## Current local evidence
- Candidate: RaksHex-P1-P2-Privacy-Fix-20261020.zip (not yet committed to GitHub).
- 7/7 hardening checks pass.
- 5/5 release-hardening checks pass using a mock ast-grep scanner.
- Real `npm test` cannot run: `@ast-grep/cli@0.51.0` is absent.
- No evidence yet that the standalone scanner and the existing `engine/apps/cli` API impact analyzer share compatible data contracts.

## Required steps before a code PR
1. Compare `engine/apps/cli` impact analysis with the submitted event-driven rules; select one canonical engine, not two.
2. Port scoped rules and validations into the existing pnpm workspace with pinned dependencies.
3. Add real ast-grep fixture CI, run existing engine typecheck/test and held-out accuracy gates.
4. Verify spec provenance, event authentication, source/metadata privacy, logs and network-egress restrictions.
5. Confirm output locking, crash recovery and tests on Linux/Windows where supported.
6. Require review of CI evidence; do not merge or deploy automatically.

Existing `main` and all other branches are preserved. This document is a staging checkpoint, not proof of product readiness.
