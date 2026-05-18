# Publishing the DevPulse VS Code extension

This guide walks through publishing `devpulse-vscode` to the VS Code
Marketplace (marketplace.visualstudio.com) and the Open VSX registry
(open-vsx.org). Keep this file out of the packaged `.vsix` (it is listed
in `.vscodeignore`).

## 1. Prerequisites

1. **Node.js** 18+ and **npm**.
2. **vsce** (the official packaging / publishing CLI):
   ```bash
   npm install -g @vscode/vsce
   ```
3. (Optional for Open VSX) **ovsx**:
   ```bash
   npm install -g ovsx
   ```

## 2. One-time publisher setup

> **Prerequisite:** `vsce publish` will fail unless the publisher ID in
> `package.json` (`"publisher": "devpulse"`) resolves to an account you
> own on marketplace.visualstudio.com. If `devpulse` is already taken by
> someone else, or you do not yet have an Azure DevOps account, the
> steps below are mandatory before any publish command will work. This
> is a one-time manual setup — it cannot be automated.

1. Create an Azure DevOps account: <https://dev.azure.com/>.
2. Under **User settings → Personal access tokens**, create a token with:
   - Organization: **All accessible organizations**
   - Scopes → **Custom defined** → **Marketplace → Manage**
   - Expiration: pick the longest you are comfortable with.
3. Create a publisher at <https://marketplace.visualstudio.com/manage>.
   The publisher ID **must match exactly** the `publisher` field in
   `package.json` (currently `"devpulse"`). If the `devpulse` slug is
   taken, either:
   - Request transfer of the namespace from the current owner, or
   - Pick a different publisher ID (e.g. `devpulse-app`, `devpulse-io`)
     and update `package.json → publisher` accordingly before
     publishing. Keep the change in sync across
     `devpulse-vscode/package.json`,
     `devpulse-vscode/README.md` badge URLs, and the recommended
     screenshot links.
4. Authenticate `vsce` once per machine:
   ```bash
   vsce login devpulse
   # paste the personal access token when prompted
   ```

For Open VSX:

1. Create an account at <https://open-vsx.org/> (GitHub OAuth works).
2. Generate an access token from **Settings → Access Tokens**.
3. Store it:
   ```bash
   export OVSX_PAT=<token>
   ```

## 3. Local dev loop

```bash
cd devpulse-vscode
npm install
npm run compile        # builds to ./out
# Press F5 in VS Code, or use the "Run Extension" launch profile,
# to open an Extension Development Host with the extension loaded.
```

Run `npm run check` before every commit — it typechecks the whole
extension without writing anything to disk.

## 4. Package a `.vsix` for manual install / review

```bash
cd devpulse-vscode
npm install
npm run compile
vsce package
```

This produces `devpulse-vscode-<version>.vsix` in the current
directory. Install it locally with:

```bash
code --install-extension devpulse-vscode-<version>.vsix
```

Share this file with reviewers/beta users before publishing.

## 5. Publish to the VS Code Marketplace

1. Bump the version in `package.json` (SemVer).
2. Add a matching entry at the top of `CHANGELOG.md`.
3. Publish:
   ```bash
   vsce publish
   # or for a prerelease:
   vsce publish --pre-release
   ```
   Listing will appear at
   <https://marketplace.visualstudio.com/items?itemName=devpulse.devpulse-vscode>
   within ~1 minute.

`vsce publish minor` / `vsce publish patch` will also auto-bump the
version field if you prefer.

## 6. Publish to Open VSX (optional but recommended)

Open VSX is the registry used by VSCodium, Gitpod, Theia, and other
non-Microsoft VS Code distributions.

```bash
cd devpulse-vscode
ovsx publish --pat "$OVSX_PAT"
```

If the namespace `devpulse` does not exist yet, create it first:
`ovsx create-namespace devpulse --pat "$OVSX_PAT"`.

## 7. Screenshots & marketplace listing

The Marketplace listing pulls the top of `README.md` for the description
and `package.json → icon` (128×128 PNG — already set to
`resources/icon.png`) for the square tile. Screenshots referenced from
`README.md` must be hosted on a public URL (e.g. raw.githubusercontent)
— relative paths are not rendered on the Marketplace.

Recommended shots (1280 × 720 or 1440 × 900):

1. **Findings tree view** grouped by severity with inline actions.
2. **Status bar** showing `DevPulse · N open · $X.XX/wk`.
3. **Run scan** command palette entry + progress notification.
4. **Settings** page (`@ext:devpulse.devpulse-vscode`) for backend URL
   and heartbeat controls.

Drop the PNGs under `devpulse-vscode/resources/` (alongside the other
extension assets — they are excluded from the packaged `.vsix` only if
they are not referenced from `README.md`) and update `README.md` with
links such as:

```markdown
![Findings tree](https://raw.githubusercontent.com/Akshu1245/devpulse-complete-codebase/main/devpulse-vscode/resources/screenshot-findings-tree.png)
```

## 8. Verify after publish

```bash
vsce show devpulse.devpulse-vscode
code --install-extension devpulse.devpulse-vscode --force
```

Then open the Command Palette, run **DevPulse: Sign in with API Key**,
and confirm the findings tree / status bar populate against your
running backend.

## 9. Unpublishing

```bash
vsce unpublish devpulse.devpulse-vscode@<version>   # remove a single version
vsce unpublish devpulse.devpulse-vscode              # remove the extension entirely
```

Use with care — published versions cannot be restored under the same
version number. Bump the version and republish instead.
