# DevPulse — First User Install Guide
## For controlled rollout (first 10–25 users)

---

### Install in 60 seconds

**Step 1: Install the extension**
- Open VS Code
- Press `Ctrl+Shift+X` (Extensions)
- Search **"DevPulse"**
- Click Install

Or install directly from the VSIX (for testers):
```
1. Download devpulse-vscode-0.2.0.vsix from the GitHub release
2. VS Code → Extensions → "..." menu → "Install from VSIX..."
3. Select the downloaded file
```

**Step 2: Get your API key**
- Go to devpulse.in/signup
- Create a free account (30 seconds, no credit card)
- Copy your API key from Settings (starts with `dp_`)

**Step 3: Connect**
- Click the DevPulse icon in the VS Code activity bar (left sidebar)
- Paste your API key → click Connect
- You'll see "Connected as [email]" — you're in

**Step 4: Import a collection**
- Run `DevPulse: Import Collections` from Command Palette (`Ctrl+Shift+P`)
- Select a Postman JSON, OpenAPI YAML/JSON, or Bruno collection
- DevPulse imports and prepares it for scanning

**Step 5: Run your first scan**
- Click the scan icon or press `Ctrl+Shift+S`
- Select your imported collection
- Findings appear in the DevPulse panel within 60 seconds

---

### Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Refresh findings | `Ctrl+Shift+D` |
| Run scan | `Ctrl+Shift+S` |
| Rerun last scan | `Ctrl+Shift+R` |
| Filter: Critical only | `Ctrl+Shift+1` |
| Filter: High only | `Ctrl+Shift+2` |
| Filter: Medium only | `Ctrl+Shift+3` |
| Filter: Low only | `Ctrl+Shift+4` |
| Mark finding resolved | `Enter` (on selected finding) |

---

### What to look for

On your first scan, DevPulse will surface:
- 🔴 **Critical** — leaked credentials, exposed secrets (fix immediately)
- 🟠 **High** — broken auth, no rate limiting, prompt injection vectors
- 🟡 **Medium** — structural issues, missing headers, deprecated patterns
- ⚪ **Low** — informational, best practice suggestions

Even a "clean" collection typically surfaces 2–4 medium/low findings. This is normal and expected.

---

### If something looks wrong

- **No findings but you expected some:** Try reimporting the collection and rescanning
- **Can't connect:** Check your API key starts with `dp_` and has no trailing spaces
- **Extension not loading:** Restart VS Code and check the DevPulse output channel (`Ctrl+Shift+U` → select "DevPulse")

---

### Share feedback

Your experience in the first 5 minutes matters most. Please tell us:
- What happened when you ran your first scan?
- Did the findings feel accurate?
- What confused you?
- Would you use this daily?

→ GitHub Discussions: https://github.com/Akshu1245/devpulse-complete-codebase/discussions
→ Email: feedback@devpulse.in
