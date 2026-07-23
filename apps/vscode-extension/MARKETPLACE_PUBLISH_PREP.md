# Marketplace publish prep — Rakshex VS Code extension

Prepared for Market Beta sprint. Code packaging is done; **publisher login is founder-only**.

## Artifact

- Package ID: `rakshex.rakshex-vscode`
- Version: `0.2.1`
- Local VSIX: `apps/vscode-extension/rakshex-vscode-0.2.1.vsix`
- Build: esbuild → `dist/extension.js` only (`npm run package`)

## Smoke against production API (after Railway is live)

1. Install VSIX: Extensions → `...` → Install from VSIX → `rakshex-vscode-0.2.1.vsix`
2. Settings → `rakshex.apiUrl` = Railway `APP_URL`
3. Command palette → **Rakshex: Sign in with API Key** (create key in web dashboard)
4. Import a collection → run scan → confirm Findings tree + Security Dashboard
5. Shadow API scan (trusted workspace) — with collections imported, output prefers untracked routes

## Publish commands (manual)

```bash
cd apps/vscode-extension
npm run package
vsce login rakshex   # Azure DevOps PAT, Marketplace Manage scope
vsce publish
```

See [PUBLISHING.md](./PUBLISHING.md) for Open VSX and publisher setup.

## Blockers (not code)

- [ ] Azure DevOps PAT + `vsce login rakshex`
- [ ] Publisher `rakshex` owned on marketplace.visualstudio.com
- [ ] Production API URL available for smoke before wide announce
