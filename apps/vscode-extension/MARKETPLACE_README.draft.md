# Rakshex — Agent Firewall for VS Code

> Control plane for your AI agents, inside the editor. Scan agent configs for
> secrets and risk, dry-run prompts through the gateway policy chain, and
> review workspace governance — without leaving VS Code.

[![Version](https://img.shields.io/visual-studio-marketplace/v/rakshex.rakshex-vscode)](https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode)

**Private beta.** This extension talks to a private-beta Rakshex control plane
at [rakshex.in](https://rakshex.in). It makes no claims about users, traction,
or certifications — it does what is listed below, and we describe nothing we
can't show in the shipped code.

---

## What it does today

### 🔍 Scan: secrets and risk in agent configs

- Scan the current file, changed files, or the whole workspace from the
  Command Palette or the Rakshex activity-bar view.
- Import Postman / OpenAPI collections and scan them for leaked credentials
  and auth weaknesses.
- Shadow API discovery: find API endpoints your agents call that you didn't
  register.
- Findings are ranked by severity in the sidebar; mark them resolved,
  in-progress, or dismissed, and accept or reject one-click auto-fix
  suggestions where available.

### 🧪 Gateway tester: see the policy verdict before you ship the prompt

Run **Rakshex: Test prompt through gateway** on any prompt (or the selected
text in your editor). The gateway runs its full policy chain — PII redaction,
prompt-injection detection, kill-switch, token budget, tool approval — and
returns **allowed** or **blocked** with the reason. Tests are dry-runs: no
tokens are charged and nothing reaches a model.

Requires a running Rakshex gateway (`rakshex.gatewayUrl` setting, default
`http://localhost:8081` for local development).

### 🛡️ Control plane panel: workspace governance at a glance

Run **Rakshex: Open AI Control Plane** to see your workspace's provider
accounts, active credentials, team subscriptions, and governed usage — pulled
live from the control plane. The policy engine behind it is declarative:
rules compiled from YAML, evaluated server-side, fail-closed.

### 💬 Security Copilot

Ask questions about your findings in natural language from inside the panel.
Answers are generated server-side against your workspace context.

---

## Quick start

```bash
# From VS Code Marketplace
ext install rakshex.rakshex-vscode

# Or search "Rakshex" in the Extensions sidebar
```

1. **Install** the extension.
2. **Sign in** — run `Rakshex: Sign in with API Key` (generate a beta key at
   [rakshex.in](https://rakshex.in)). Your key is stored in VS Code's
   SecretStorage (OS keychain), never in settings.
3. **Set your workspace** — `rakshex.workspaceId` in Settings for control-plane
   inventory and governed usage.
4. **Scan** — run `Rakshex: Scan Workspace` or import a collection.

## Privacy

| What the extension does | What it never does |
| ----------------------- | ------------------ |
| Sends file contents you explicitly scan to your Rakshex API | Scan or send files without you invoking a scan |
| Sends file-change activity events (contents never included) | Store your source code on our servers |
| Stores finding summaries so the sidebar can list them | Share data with third parties |

Your API key stays in your OS keychain. You can audit exactly what leaves the
machine: every request goes to your configured `rakshex.apiUrl`
(default `https://api.rakshex.in`).

## Honest boundaries

- **Private beta** — the control plane is not a production SLA service.
- The extension does not claim certifications, universal provider coverage,
  or production-readiness.
- Kill-switch and policy state live server-side; the extension surfaces
  findings and governance views — it does not enforce policy locally.
- Demo mode (`rakshex.runDemo`) exists for walkthroughs and seeds clearly
  labeled sample data; it is not real scanning.

---

## Screenshots

> **Publisher note (remove before publishing):** Marketplace README images must
> be absolute URLs, and screenshots must be re-taken against the packaged
> build. Upload fresh captures and reference them from the real repository:
>
> `https://raw.githubusercontent.com/Akshu1245/Rakshex-complete-codebase/main/apps/vscode-extension/resources/screenshot-*.png`
>
> Do **not** hotlink screenshots from `github.com/rakshex/rakshex` (a different
> org/repo). Verify each screenshot shows the current control-plane UI before
> publishing.

![Rakshex command palette](https://raw.githubusercontent.com/Akshu1245/Rakshex-complete-codebase/main/apps/vscode-extension/resources/screenshot-command-palette.png)
![Rakshex findings tree](https://raw.githubusercontent.com/Akshu1245/Rakshex-complete-codebase/main/apps/vscode-extension/resources/screenshot-findings-tree.png)
![Rakshex status bar](https://raw.githubusercontent.com/Akshu1245/Rakshex-complete-codebase/main/apps/vscode-extension/resources/screenshot-status-bar.png)

---

## Documentation

- [Getting Started](https://docs.rakshex.in/getting-started)
- [Agent Firewall policy model](https://docs.rakshex.in/agent-firewall)
- [Gateway configuration](https://docs.rakshex.in/gateway)
- [API Reference](https://docs.rakshex.in/api)

---

## Contributing

Source: [github.com/Akshu1245/Rakshex-complete-codebase](https://github.com/Akshu1245/Rakshex-complete-codebase)

- Report issues: [GitHub Issues](https://github.com/Akshu1245/Rakshex-complete-codebase/issues)
- Feature requests: open an issue with the `enhancement` label

---

## Security

Found a vulnerability? See our [Responsible Disclosure Policy](https://rakshex.in/security).

---

## License

MIT © Rakshex
