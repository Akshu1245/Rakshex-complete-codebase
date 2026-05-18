# DevPulse — Reddit Launch Posts

---

## r/LocalLLaMA / r/MachineLearning

**Title:** I built a VS Code extension that scans your AI agents for leaked keys, hidden costs, and security issues — free, no code upload

**Body:**

Been building with LLMs for a while and kept running into the same pattern: security and cost issues hide in API collections, environment configs, and agent scaffolding. They don't surface until something breaks or a bill arrives.

Built DevPulse to fix this. It's a VS Code extension that:

- **Finds leaked API keys** in Postman collections, OpenAPI specs, and environment files
- **Tracks hidden LLM token costs** — especially from unoptimized agent calls and retry loops
- **Scans agent configurations** (LangChain, CrewAI, AutoGen) for security misconfigs
- **Detects shadow APIs** your agents call that you've forgotten about

**How it works:**
1. Install from VS Code Marketplace (search "DevPulse")
2. Import a collection or spec
3. Hit scan — first findings in 60 seconds

**Privacy note:** Your source code never leaves your machine. We scan API metadata and configs only.

It's in public beta and free to start. Would love feedback from this community — especially if you're building multi-agent systems. What security/cost issues have you run into?

---

## r/webdev / r/programming

**Title:** Show HN-style: Built a VS Code extension to catch security issues in AI agent configs before they hit production

**Body:**

Quick background: I kept seeing (and making) the same mistake while building AI-powered apps — credentials leaking into shared collections, agents silently burning API budget in retry loops, security configs drifting.

DevPulse is my attempt at a dedicated security lens for AI development workflows. It sits in the VS Code sidebar and continuously watches your API collections and agent configs.

What it catches:
- Leaked credentials (OpenAI keys, Anthropic keys, etc. embedded in collection headers or env vars)
- Unoptimized LLM calls contributing to hidden token spend
- Missing rate limiting, broken auth, prompt injection vectors
- Undocumented API endpoints your agents are calling

Tech: VS Code extension (TypeScript), tRPC backend, local-first scanning.

Happy to answer questions about the architecture or the security rules engine. Also genuinely curious what pain points others are hitting while building with AI.

---

## r/vscode

**Title:** DevPulse — security scanner for AI agents and APIs, now in public beta (VS Code extension)

**Body:**

Released DevPulse as a public beta today. It's a VS Code extension focused on one specific problem: AI agents and API-heavy apps are hard to keep secure because the attack surface is spread across collections, configs, and agent scaffolding rather than your main codebase.

Features:
- Severity-ranked findings tree (Critical/High/Medium/Low)
- One-click scan and rerun
- Weekly digest showing your security posture over time
- Compact mode for power users
- Offline/mock mode for testing without a backend
- Keyboard shortcuts for the full workflow

Install: search "DevPulse" in Extensions or `ext install devpulse.devpulse`

Free tier includes 1 collection and 10 scans/month. Would love feedback on the UX and whether the findings feel accurate to your stack.
