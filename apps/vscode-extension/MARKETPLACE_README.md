# Rakshex — AI Runtime Protection

> Find security issues, hidden costs, and compliance risks in your AI agents and APIs before they hit production.

[![Version](https://img.shields.io/visual-studio-marketplace/v/rakshex.rakshex)](https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/rakshex.rakshex)](https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/rakshex.rakshex)](https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex)

---

## What Rakshex Does

Rakshex scans your AI agent configurations, API collections, and LLM integrations directly inside VS Code to find:

- **Leaked API keys** in environment files and collections
- **Hidden token costs** from unoptimized LLM calls
- **Security misconfigurations** in agent frameworks (LangChain, CrewAI, AutoGen)
- **Compliance gaps** in AI-generated code
- **Shadow APIs** — endpoints your agents call that you forgot about

**Your source code never leaves your machine.** We scan metadata and configurations, not your proprietary code.

---

## Install

```bash
# From VS Code Marketplace
ext install rakshex

# Or search "Rakshex" in the Extensions sidebar
```

---

## Quick Start (30 seconds)

1. **Install** the Rakshex extension
2. **Sign in** with your API key (generate one free at [rakshex.in](https://rakshex.in))
3. **Import** a Postman collection or OpenAPI spec
4. **Run scan** — Rakshex finds issues in seconds
5. **Review findings** in the Security Dashboard

---

## Features

### 🔍 Real-Time Security Scanning

Scan any API collection or AI agent configuration file with one click. Find leaked secrets, misconfigurations, and compliance issues instantly.

### 🛡️ AgentGuard

Detects when AI agents are about to:

- Expose sensitive data to LLM providers
- Enter infinite cost loops
- Call unauthorized APIs
- Generate non-compliant code

### 💰 Cost Intelligence

- Track LLM spend per project
- Identify expensive agent loops
- Flag unoptimized prompt patterns
- Forecast monthly API costs

### 🧠 AI Security Copilot

Ask natural language questions about your security posture:

- "What are my highest-risk findings?"
- "How do I fix this leaked API key?"
- "Which agents cost the most?"

### 📊 Security Dashboard

- Severity-ranked findings (Critical / High / Medium / Low)
- Weekly cost summaries
- Scan history and trends
- Team sharing (Pro plan)

### ⚡ Auto-Fix Suggestions

One-click fixes for common issues:

- Rotate exposed credentials
- Add rate limiting headers
- Sanitize PII in prompts
- Encrypt sensitive parameters

---

## Privacy First

| What We Do                    | What We Never Do              |
| ----------------------------- | ----------------------------- |
| Scan API metadata and configs | Upload your source code       |
| Track scan counts for billing | Store API responses           |
| Store finding summaries       | Share data with third parties |
| Anonymous usage analytics     | Require cloud processing      |

**Local-first scanning available** — run entirely offline with the self-hosted option.

---

## Supported Platforms

- **VS Code** (primary) — this extension
- **JetBrains** — coming Q3 2026
- **CLI** — `npm install -g @rakshex/cli`
- **CI/CD** — GitHub Actions, GitLab CI

---

## Pricing

| Plan           | Price  | Best For                                         |
| -------------- | ------ | ------------------------------------------------ |
| **Free**       | $0     | Individual developers, 1 collection, 10 scans/mo |
| **Pro**        | $29/mo | Power users, unlimited scans, team of 3          |
| **Team**       | $99/mo | Engineering orgs, 10 users, SSO, audit logs      |
| **Enterprise** | Custom | Large orgs, dedicated support, SLA               |

[Start free →](https://rakshex.in/signup)

---

## What Developers Say

> "Found a leaked OpenAI key in a collection I'd shared with the team. Rakshex caught it in 10 seconds."
> — _Senior Engineer, Series B startup_

> "The cost tracking alone saved us $400 in the first month. We had an agent in an infinite loop burning tokens."
> — _Tech Lead, AI-native company_

---

## Documentation

- [Getting Started](https://docs.rakshex.in/getting-started)
- [Security Rules](https://docs.rakshex.in/rules)
- [AgentGuard Configuration](https://docs.rakshex.in/agentguard)
- [API Reference](https://docs.rakshex.in/api)
- [Self-Hosting](https://docs.rakshex.in/self-host)

---

## Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/rakshex/rakshex/blob/main/CONTRIBUTING.md).

- Report issues: [GitHub Issues](https://github.com/rakshex/rakshex/issues)
- Feature requests: [GitHub Discussions](https://github.com/rakshex/rakshex/discussions)
- Join our community: [Discord](https://discord.gg/rakshex)

---

## Security

Found a vulnerability? Please see our [Responsible Disclosure Policy](https://rakshex.in/security).

---

## License

MIT © Rakshex
