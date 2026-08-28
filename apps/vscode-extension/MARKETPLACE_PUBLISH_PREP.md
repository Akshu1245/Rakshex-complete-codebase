# Marketplace publish preparation — RaksHex VS Code extension

This checklist distinguishes repository work from external Marketplace/account work. Do not treat an old local `.vsix` filename as evidence that the current source has been packaged or publicly published.

## Repository preparation

Before publication:

- [ ] exact release commit has green required CI + Security scan
- [ ] `apps/vscode-extension/package.json` version/publisher/links are correct
- [ ] extension typecheck/tests/build pass on the repository Node 24 + pnpm baseline
- [ ] a VSIX is produced from that exact source commit
- [ ] the packaged VSIX is installed and smoke-tested against the intended beta/staging API
- [ ] CHANGELOG describes the release accurately
- [ ] Marketplace README/screenshots contain no fake usage, customer or availability claims

Preferred dry run: manually dispatch `.github/workflows/publish-extension.yml` with `dryRun=true`. The workflow packages and uploads a reviewable VSIX without publishing it or committing a version bump.

## External/account preparation

- [ ] Marketplace publisher ID in `package.json` is owned/controlled by the operator
- [ ] `VSCE_PAT` exists in GitHub Actions secrets for the approved publishing environment
- [ ] intended API environment/domain is reachable for post-install smoke
- [ ] support/security contact channels used in the listing are monitored

These cannot be completed truthfully from source code alone.

## Smoke the packaged extension

1. Install the exact workflow-produced VSIX into a clean VS Code profile.
2. Set `rakshex.apiUrl` to the intended beta/staging API.
3. Run **RaksHex: Sign in with API Key** using a non-production test/beta workspace key.
4. Exercise refresh, a supported scan path, findings navigation and health status.
5. Test trusted-workspace-only behavior separately where applicable.
6. Record VSIX/version, source commit and target API environment.

## Publish

After the dry-run artifact is accepted, run the same workflow with `dryRun=false` from the approved release branch and with `VSCE_PAT` configured. The workflow verifies the extension again, packages the exact VSIX, publishes that package, and records the version/tag.

See `PUBLISHING.md` for the full procedure and Open VSX notes.

## Claim boundary

A local/workflow VSIX means **packaged**, not **Marketplace live**. The extension is public only after the external Marketplace listing is successfully published and verified from a clean install.
