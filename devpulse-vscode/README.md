# DevPulse — Stop AI agents from burning your API budget

> The first VS Code extension that reveals hidden LLM costs, auto-stops
> infinite loops, and scans your API collections for vulnerabilities.

![DevPulse hero](resources/screenshot-hero.png)

---

## The Problem

If you're building with AI, you're probably paying **3× more** for LLM APIs than you realize.

- **Hidden reasoning tokens** aren't shown in provider dashboards
- **Rogue agents** can loop infinitely, burning $200+ overnight
- **API keys leak** into shared collections without anyone noticing

## What DevPulse Does

### 1. Hidden Cost Detection 💰

Reveals reasoning tokens that OpenAI, Anthropic, and Gemini hide from you.

- Per-endpoint cost breakdown
- Weekly spend tracking
- Alerts when costs spike unexpectedly

![Cost dashboard](resources/screenshot-cost.png)

### 2. AgentGuard Kill Switch 🛑

Auto-stops infinite loops and runaway agents in real-time.

- Detects recursive API call patterns
- Blocks cost anomalies
- Configurable thresholds per project

![AgentGuard alert](resources/screenshot-agentguard.png)

### 3. Instant Security Scan 🔍

Import any Postman, OpenAPI, or Bruno collection. Get a full security report in seconds.

- Secret detection
- Auth weakness detection
- Injection vulnerability scanning
- OWASP API Top 10 coverage

![Findings](resources/screenshot-findings.png)

## Setup (30 Seconds)

1. **Install** — Search "DevPulse" in the VS Code Extensions panel
2. **Connect** — Run `DevPulse: Sign in with API Key` (get a free key at [devpulse.in](https://devpulse.in))
3. **Import** — Drag any API collection into the DevPulse sidebar
4. **Scan** — Click "Run Scan" and see your first findings

Most developers find at least **2 issues** they didn't know about.

## What Developers Say

> "DevPulse found $1,200 in hidden reasoning costs we didn't know existed."
> — Engineering Lead, Series B SaaS

> "AgentGuard stopped an infinite loop that would have burned $500 overnight."
> — CTO, AI Startup

> "The fastest security tool I've ever used. Found 6 issues in 30 seconds."
> — Staff Engineer, Fortune 500

## Supported Providers

| Provider        | Cost Tracking | AgentGuard | Scanning |
| --------------- | ------------- | ---------- | -------- |
| OpenAI          | ✅            | ✅         | ✅       |
| Anthropic       | ✅            | ✅         | ✅       |
| Google (Gemini) | ✅            | ✅         | ✅       |
| Azure OpenAI    | ✅            | ✅         | ✅       |
| AWS Bedrock     | ✅            | ✅         | ✅       |
| Local (Ollama)  | ✅            | ✅         | ✅       |

## Commands

| Command                         | What It Does                                     |
| ------------------------------- | ------------------------------------------------ |
| `DevPulse: Run scan`            | Scan any imported collection for vulnerabilities |
| `DevPulse: Import collection`   | Import Postman, OpenAPI, or Bruno files          |
| `DevPulse: Open security panel` | View findings dashboard inside VS Code           |
| `DevPulse: Weekly summary`      | See money saved and threats blocked this week    |

## Privacy First

- 🔒 **Your code never leaves your machine** — we only scan collections you explicitly import
- 🔒 **API keys are encrypted** — stored in VS Code's SecretStorage (OS keychain)
- 🔒 **No prompt logging** — we never see your LLM prompts or responses
- 🔒 **Telemetry is optional** — opt out anytime in settings

Read our full [Privacy Policy](https://devpulse.in/privacy).

## Pricing

| Plan           | Cost   | Best For                                 |
| -------------- | ------ | ---------------------------------------- |
| **Free**       | $0     | Individual developers, 3 collections     |
| **Pro**        | $29/mo | Professional developers, unlimited scans |
| **Enterprise** | Custom | Teams, SSO, on-premise                   |

**Free during beta.** No credit card required.

## Support

- 💬 [Discord community](https://discord.gg/devpulse)
- 🐛 [GitHub Issues](https://github.com/akshaynhcm-droid/Devpulse-/issues)
- 📧 [support@devpulse.in](mailto:support@devpulse.in)

## License

MIT
