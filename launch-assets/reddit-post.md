# DevPulse – Reddit Launch Posts

## r/webdev / r/programming / r/devops / r/MachineLearning

### Title
I built an AI API Security Scanner that finds token leaks + prompt injection patterns in < 2 seconds – DevPulse

### Body
AI agents are everywhere — but they introduce attack vectors traditional security tools miss: prompt injection, unrestricted tool use, SSRF through agent tool calls, and hardcoded API keys for every AI provider imaginable.

DevPulse scans your code for all of them.

**Pillar 1: AI API Security Scanner**
- 🔓 14 token/secret patterns (OpenAI, Anthropic, AWS, Google, Stripe, GitHub…)
- 🤖 7 AI agent attack detectors (prompt injection, SSRF, tool abuse, code execution)
- 📋 OWASP API Security Top 10 (2023) coverage
- 🧠 AI-powered fix suggestions via Groq LLM

**Pillar 2: API Cost Intelligence**
- 💸 Real-time cost tracking across 20+ AI models
- 📈 30-day spend forecasting
- 🚨 Anomaly detection with alerts
- ⚡ Optimization tips: model switching, caching, batching

**Pillar 3: VS Code Extension**
- Inline token leak warnings as you type
- Cost estimation per API call
- One-click scan from command palette

**Stack:** FastAPI + Next.js + PostgreSQL + Redis + AES-256

**Pricing:** Free (3 scans/day) | Pro $29/mo | Team $99/mo

**GitHub:** https://github.com/ganesh2317/DevPulse

What AI API security concerns does your team face? Would love feedback!

---

## r/SideProject

### Title
DevPulse v4.0 — AI API Security & Cost Intelligence Platform

### Body
Just shipped v4.0 of DevPulse, pivoted from general API monitoring to focused AI API security + cost intelligence.

The platform now detects 14 token/secret leak patterns, 7 AI agent attack vectors (prompt injection, SSRF, etc.), and tracks costs across 20+ AI models with forecasting and anomaly detection.

Also ships with a VS Code extension that warns you about token leaks as you type.

Free tier available. Built with FastAPI + Next.js + PostgreSQL.

Link: https://github.com/ganesh2317/DevPulse
