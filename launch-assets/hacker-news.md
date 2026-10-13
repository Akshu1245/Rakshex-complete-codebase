# DevPulse – Hacker News Launch Post

## Title Options (pick one)
1. Show HN: DevPulse – AI API Security Scanner + Cost Intelligence Platform
2. Show HN: I built a tool that finds token leaks and AI agent attacks in < 2 seconds
3. Show HN: DevPulse – Scan for prompt injection, token leaks, and optimize AI API costs

## Post Body

I built DevPulse after realizing that AI agents introduce attack vectors traditional security scanners don't cover — prompt injection, unrestricted tool use, SSRF through agent tool calls, and hardcoded API keys for 14+ AI providers.

Meanwhile, teams are burning $5K+/mo on AI API calls without knowing where the money goes.

DevPulse is an open-source platform with three pillars:

**1. AI API Security Scanner**
- 14 token/secret patterns (OpenAI, Anthropic, AWS, Google, Stripe, GitHub, Groq, HuggingFace…)
- 7 AI agent attack detectors (prompt injection, SSRF, unrestricted tools, code execution…)
- OWASP API Security Top 10 (2023) coverage
- AI-powered fix suggestions via Groq LLM

**2. API Cost Intelligence**
- Real-time cost tracking across 20+ AI models (GPT-4o, Claude, Gemini, Llama, Mixtral…)
- 30-day spend forecasting (weighted moving average)
- Anomaly detection with automatic alerts
- Optimization recommendations (model switching, caching, batching)

**3. VS Code Extension**
- Inline token leak warnings as you type
- Cost estimation per API call in hover tooltips
- One-click security scan from command palette

Stack: FastAPI (Python) + Next.js + PostgreSQL + Redis + AES-256. Fully self-hostable via Docker.

Free tier: 3 scans/day. Pro: $29/mo. Team: $99/mo.

GitHub: https://github.com/ganesh2317/DevPulse

Technical questions welcome:
1. What AI agent attack patterns are you most concerned about?
2. Would you run this in CI/CD as a pre-deploy security gate?
3. How do you currently track AI API costs?
