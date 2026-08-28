# Publishing the RaksHex VS Code extension

The extension source lives at `apps/vscode-extension`. The repository workflow `.github/workflows/publish-extension.yml` is the preferred packaging/publishing path because it verifies the extension on the same **Node 24 + pnpm** baseline as the monorepo before producing a VSIX.

## Prerequisites

- Node.js **24.x**
- pnpm from the repository `packageManager` declaration
- a clean checkout of the monorepo
- for Marketplace publishing: an Azure DevOps/VS Code Marketplace publisher whose ID matches `apps/vscode-extension/package.json`
- for Open VSX publishing: an Open VSX namespace/token

Do not commit marketplace personal access tokens or Open VSX tokens.

## Local verification

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter rakshex-vscode typecheck
pnpm --filter rakshex-vscode test
pnpm --filter rakshex-vscode build
```

The full repository CI also includes the extension in the root typecheck/test/build graph. A Marketplace release should be cut only from a commit whose required repository CI/security gates are green.

## Package a VSIX locally

```bash
cd apps/vscode-extension
pnpm dlx @vscode/vsce package --out rakshex-vscode-local.vsix
```

Install the resulting local artifact for review:

```bash
code --install-extension rakshex-vscode-local.vsix --force
```

A local VSIX proves packaging, not Marketplace publication.

## One-time VS Code Marketplace publisher setup

The package currently declares publisher `rakshex`. Before a non-dry-run workflow can publish:

1. Create/access an Azure DevOps account.
2. Create a Marketplace publisher matching the package `publisher` field exactly.
3. Create a Marketplace-scoped token according to Microsoft's current Marketplace instructions.
4. Store the token as the repository/environment GitHub Actions secret `VSCE_PAT`.

If the declared publisher namespace is unavailable, update the package publisher and all Marketplace links deliberately in a reviewed commit; do not silently publish under an unrelated identity.

## GitHub Actions release path

Run **Publish VS Code Extension** manually.

Inputs:

- `versionBump`: `patch`, `minor`, or `major`
- `dryRun`: defaults to `true`

### Dry run

The workflow:

1. installs the monorepo with the frozen pnpm lockfile on Node 24,
2. typechecks/tests/builds `rakshex-vscode`,
3. prepares a version/changelog in the temporary runner checkout,
4. packages a VSIX,
5. uploads the VSIX as a workflow artifact,
6. does **not** publish or push a version commit.

Use this first for every release candidate.

### Marketplace publish

With `dryRun=false`, the workflow additionally:

1. requires `VSCE_PAT`,
2. publishes the exact packaged VSIX,
3. commits the version/changelog update back to the dispatch branch,
4. creates a `vscode-v<version>` tag.

Do not use the production publish mode on an arbitrary feature branch. Promote/merge the intended release commit first, then dispatch the release from the branch/tag policy you have chosen.

## Manual Marketplace publish (fallback)

Only use this when the GitHub workflow cannot be used and preserve the same verification sequence:

```bash
pnpm install --frozen-lockfile
pnpm --filter rakshex-vscode typecheck
pnpm --filter rakshex-vscode test
pnpm --filter rakshex-vscode build
cd apps/vscode-extension
pnpm dlx @vscode/vsce package --out rakshex-vscode-release.vsix
pnpm dlx @vscode/vsce publish --packagePath rakshex-vscode-release.vsix -p "$VSCE_PAT"
```

Keep the token in an environment variable/secret manager; do not paste it into scripts or documentation.

## Open VSX (optional)

Open VSX publication is a separate external account action. After creating the matching namespace and storing a token locally/securely, publish the already-reviewed package with the current `ovsx` CLI. Do not claim Open VSX availability until the listing is actually verified.

## Marketplace assets

`package.json` uses `resources/icon.png`. Keep screenshots/assets under the extension directory and make sure every Marketplace README URL resolves publicly before publishing. Avoid fake usage numbers, badges or customer logos.

Recommended screenshots:

- findings tree grouped by severity
- status bar / health state
- scan command flow
- extension settings/backend connection state

## Post-publish verification

After Marketplace publication:

1. verify the listing resolves for `publisher.name`,
2. install the published version into a clean VS Code profile,
3. authenticate with a beta/test workspace key,
4. exercise refresh + scan + finding navigation,
5. verify backend URL/configuration points to the intended environment,
6. record the published version and source commit.

Marketplace/Open VSX publication is external deployment work. Source code or a packaged VSIX alone does not prove the public listing is live.
