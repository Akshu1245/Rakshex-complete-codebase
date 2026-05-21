# Rakshex VS Code Extension Release Checklist

> Steps to publish a new version to the VS Code marketplace.
> Date: 2026-05-17

---

## PRE-RELEASE

### Code Quality

- [ ] All tests passing (`npm test` in rakshex-vscode/)
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] ESLint passes (`npx eslint src/ --ext .ts`)
- [ ] No `console.log` or `debugger` statements
- [ ] No TODO/FIXME comments in release code

### Version Bump

- [ ] Update `package.json` version (semver)
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Update `README.md` if features changed
- [ ] Update `PUBLISHING.md` if process changed

### Assets

- [ ] Icon `resources/icon.png` is 128x128 or 256x256
- [ ] Screenshots updated in README
- [ ] Gallery banner colors match branding

---

## BUILD & TEST

```bash
cd rakshex-vscode
npm ci
npm run compile
npm run test
```

- [ ] `out/extension.js` generated
- [ ] `.vscodeignore` excludes: `node_modules/`, `src/`, `*.test.ts`
- [ ] Extension installs locally without errors
- [ ] Welcome view renders correctly
- [ ] Auth flow works end-to-end
- [ ] Scan command works
- [ ] Demo mode works offline
- [ ] Status bar updates correctly

---

## PACKAGE

```bash
npm install -g @vscode/vsce
vsce package
```

- [ ] `.vsix` file generated
- [ ] File size < 5MB
- [ ] Install from .vsix works: `code --install-extension rakshex-vscode-X.X.X.vsix`

---

## PUBLISH

```bash
vsce publish
```

- [ ] Logged in with `vsce login rakshex`
- [ ] PAT has `Marketplace > Publish` scope
- [ ] Publish succeeds
- [ ] Verify on marketplace: https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode
- [ ] Download count visible

---

## POST-RELEASE

- [ ] Announce on Twitter/X
- [ ] Post in relevant communities (r/vscode, HN, Dev.to)
- [ ] Update website download links
- [ ] Monitor Sentry for extension errors
- [ ] Respond to marketplace reviews within 24h

---

_Checklist maintained by Rakshex engineering team._
