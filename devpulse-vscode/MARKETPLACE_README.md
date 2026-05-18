# DevPulse — AI Runtime Protection

> Stop AI agents from burning your API budget. Find leaked keys, hidden token costs, and security risks in VS Code — first scan in 60 seconds.

[![Version](https://img.shields.io/visual-studio-marketplace/v/devpulse.devpulse)](https://marketplace.visualstudio.com/items?itemName=devpulse.devpulse)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/devpulse.devpulse)](https://marketplace.visualstudio.com/items?itemName=devpulse.devpulse)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/devpulse.devpulse)](https://marketplace.visualstudio.com/items?itemName=devpulse.devpulse)

---

## What DevPulse Finds

DevPulse scans your AI agent configurations, API collections, and LLM integrations directly inside VS Code:

- 🔑 **Leaked API keys** in Postman collections, environment files, and agent configs
- 💰 **Hidden token costs** from unoptimized LLM calls, retry loops, and reasoning tokens
- 🛡️ **Security misconfigurations** in agent frameworks (LangChain, CrewAI, AutoGen)
- 🔍 **Missing auth, rate limits, and injection vectors** across your API surface
- 👻 **Shadow APIs** — endpoints your agents call that you've forgotten about

**Your source code never leaves your machine.** We scan API metadata and configurations only.

---

## Quick Start

```
1. Install DevPulse (this extension)
2. Sign in with your API key → devpulse.in (free, 30 seconds)
3. Import a Postman collection or OpenAPI spec
4. Run scan — first findings in under 60 seconds
```

---

## Screenshots

![DevPulse findings tree — severity-grouped security issues](resources/screenshot-findings-tree.png)

*Findings grouped by severity (Critical → High → Medium → Low). One click to mark resolved.*

![DevPulse command palette — scan, rerun, digest](resources/screenshot-command-palette.png)

*Full workflow via Command Palette or keyboard shortcuts.*

![DevPulse status bar — live scan status and finding count](resources/screenshot-status-bar.png)

*Live finding count and scan status always visible in the status bar.*

---

## Features

### 🔍 One-Click Security Scanning

Import any Postman collection, OpenAPI spec, or Bruno collection. Get a full security report in seconds.

### 📊 Severity-Ranked Findings Tree

Critical and High findings surface immediately. Mark findings as resolved, in-progress, or dismissed. Filter by severity. Toggle compact mode for large collections.

### 💰 Cost Intelligence

Track LLM spend per project. Identify expensive agent retry loops. Get alerts when costs spike unexpectedly.

### 📅 Weekly Digest

Your security posture week over week — findings trend, scan streak, resolved issues, top open items.

### ⚡ Rerun Scan

`Ctrl+Shift+R` reruns your last scan instantly. Tight feedback loop between code change and security check.

### 🔒 Privacy First

| We do | We never do |
|---|---|
| Scan API metadata and configs | Upload your source code |
| Track scan counts for billing | Store API responses |
| Store finding summaries | Share data with third parties |

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Refresh findings | `Ctrl+Shift+D` |
| Run new scan | `Ctrl+Shift+S` |
| Rerun last scan | `Ctrl+Shift+R` |
| Filter Critical | `Ctrl+Shift+1` |
| Filter High | `Ctrl+Shift+2` |

---

## Pricing

| Plan | Price | Includes |
|---|---|---|
| **Free** | $0 | 1 collection, 10 scans/month |
| **Pro** | $29/mo | Unlimited scans, 3 team seats |
| **Team** | $99/mo | 10 users, SSO, audit logs |

[Start free →](https://devpulse.in/signup)

---

## Support & Feedback

- [GitHub Issues](https://github.com/Akshu1245/devpulse-complete-codebase/issues)
- [GitHub Discussions](https://github.com/Akshu1245/devpulse-complete-codebase/discussions)
- Email: feedback@devpulse.in

---

MIT © DevPulse
