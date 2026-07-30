# Rakshex 2026-07-30 Release

This package contains the deployable monorepo, an installable VS Code extension,
operator runbooks, QA evidence, and the supplied editable legal drafts.

## Start here

1. Read `source/docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md`.
2. Complete every open row in
   `source/docs/operations/LAUNCH_SIGNOFF_MATRIX.md`.
3. Complete and obtain counsel approval for every field listed in
   `source/docs/legal/WORD_DRAFT_PLACEHOLDER_REGISTER.md`.
4. Replace the currently deployed marketing site using
   `source/docs/operations/LIVE_SITE_REPLACEMENT_NOTICE.md`.
5. Configure production secrets from `source/.env.example`; never place secrets
   in the ZIP, source control, browser variables, or VS Code settings.
6. Deploy PostgreSQL migrations, API, worker, and web in that order.
7. Run the HTTPS buyer journey and attach evidence before enabling paid plans.

## Package layout

- `source/` — complete source release
- `artifacts/rakshex-vscode-0.2.1.vsix` — installable editor extension
- `paperwork/Rakshex-Production-Launch-and-Operations-Binder-2026-07-30.docx`
- `paperwork/editable-legal-drafts/` — user-supplied, unexecuted Word drafts
- `QA_EVIDENCE.md` — local verification and environment limitations
- `SHA256SUMS` — integrity hashes for packaged artifacts

## Important boundary

The code is deployable. Paid public launch is not authorized until production
credentials, real-provider exercises, named operational owners, legal fields,
and sign-offs are complete. The package does not claim a certification, patent,
benchmark, customer endorsement, or legal approval.
