# Dev.to Launch Article

**Title:** I built a VS Code extension that catches security issues in AI agents before they hit production

**Tags:** vscode, security, ai, devtools

---

## Article

Last year I made an embarrassing mistake.

I had an OpenAI API key embedded in a Postman collection I'd shared with three teammates. It sat there for two weeks before anyone noticed. By then, someone had used it — not for anything catastrophic, but enough to trigger an unexpected bill and a very awkward conversation.

That wasn't a unique mistake. It's a pattern: when you're building fast with AI agents and APIs, security issues hide in places you're not looking. Not in your main codebase — in the supporting infrastructure. Collections. Environment configs. Agent scaffolding. LLM call configurations.

So I built DevPulse.

---

### What it is

DevPulse is a VS Code extension that scans your AI agent configurations and API collections for:

- **Leaked credentials** — API keys, tokens, and secrets embedded in collection headers, body fields, or environment files
- **Hidden token costs** — unoptimized LLM calls, infinite retry loops, reasoning tokens providers don't surface prominently
- **Security misconfigurations** — missing auth, no rate limiting, broken callback URLs in agent frameworks
- **Shadow APIs** — endpoints your agents are calling that you've forgotten you added
- **Prompt injection vectors** — user-controlled inputs feeding directly into system prompts

### How it works

1. Install the extension from the VS Code Marketplace (search "DevPulse")
2. Connect your API key from devpulse.in (free account, takes 30 seconds)
3. Import a Postman collection or OpenAPI spec
4. Hit scan — findings appear in the sidebar in under a minute

```
First scan: ~60 seconds
Your code: never leaves your machine
Data scanned: API metadata and configs only
```

### The findings tree

Findings are grouped by severity — Critical, High, Medium, Low — and show the collection, category, and current status (open, in-progress, resolved). You can mark findings resolved, filter by severity, or toggle compact mode for large collections.

### Weekly digest

Every week, DevPulse generates a digest showing your security posture trend, scan streak, resolved findings, and top open issues. Small habit, meaningful protection.

### What I learned building it

**The hardest part wasn't the scanner** — it was the onboarding. Security tools suffer from a credibility problem: if your first scan returns nothing, users assume the tool is broken, not that their repo is clean.

We solved this with mock mode (deterministic seeded responses for testing), clear empty states, and a clean-repo-aware onboarding path that doesn't require finding issues to complete onboarding.

**The second hardest part was trust copy.** Every line of UI copy needs to answer "is this safe?" before the user asks. "Your code never leaves your machine" isn't just a feature — it's the first question every developer has before they install a security tool.

---

### Try it

DevPulse is in public beta. Free tier includes 1 collection and 10 scans/month — enough to know if it catches anything real for your stack.

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=devpulse.devpulse)
- [GitHub](https://github.com/Akshu1245/devpulse-complete-codebase)
- [devpulse.in](https://devpulse.in)

I'm genuinely curious what security and cost issues you've encountered building AI-powered apps. Drop them in the comments.
