# Product Hunt Launch Kit

## Launch Date Target

TBD — align with a weekday (Tuesday or Wednesday morning PST) for maximum traffic.

---

## Product Listing

**Name:** Rakshex
**Tagline:** Open-source security + cost monitoring for production AI agents
**Category:** Developer Tools
**Website:** https://rakshex.in
**Maker:** @rakshexhq (Twitter) + individual maker accounts

### Description (260 char max)

Secure your AI agents before they cost you money or leak data. Open-source. Self-hosted. Works with any LLM.

### Full Description

Rakshex is the open-source platform that monitors, secures, and governs production AI agents — all in one place.

**Security**

- Prompt injection detection (50+ payload patterns)
- PII redaction in request/response
- Shadow API discovery
- Credential leak scanning in Postman/OpenAPI collections

**Cost Control**

- Per-request cost attribution across OpenAI, Anthropic, Gemini, Cohere, Mistral, Groq
- Anomaly alerts when spend spikes
- Hard kill switch + budget caps

**Compliance**

- PCI DSS, OWASP, SOC 2 mapped findings
- Immutable audit logs
- Data Processing Agreement included

**Developer Experience**

- VS Code extension with inline warnings
- GitHub Action for PR-level security gates
- Next.js dashboard with real-time telemetry

**Open Source & Self-Hosted**

- Docker Compose in 10 minutes
- Full data sovereignty (Indian data residency supported)
- No vendor lock-in

Shipped by a team of 1 in India with 4 patents pending. Built because we couldn't find a tool that did security + cost + compliance without $50K enterprise contracts.

---

## Screenshots / Gallery

1. **Dashboard Overview** — collections, scans, risk score
2. **Security Findings** — severity-ranked list with remediation
3. **Cost Analytics** — per-model spend with anomaly detection
4. **Policy Rules** — drag-and-drop rule builder
5. **VS Code Extension** — inline warning on suspicious API call
6. **Kill Switch** — one-click traffic stop with Slack alert

_Prep 6 PNGs at 1600×900 with clean UI, no fake data, real scan results._

---

## Maker Comment (First Comment)

> Hey PH community — built this after watching a client's AI agent leak PII to a third-party LLM because their "observability tool" only logged latency, not content. That incident cost them a compliance audit and 3 weeks of engineering time.
>
> Rakshex is different: it actually scans for prompt injection, shadow APIs, and credential leaks — not just token counts. And it's open-source, so you can self-host on your own infra (Indian data residency, EU, whatever you need).
>
> The kill switch is my favorite feature: set a monthly budget, and if a runaway script tries to blow it, traffic hard-stops. No "alert that gets buried in Slack." Actually stops.
>
> Built by 1 person in Bangalore. 4 patents pending. Would love your feedback — especially if you're already using Helicone, Portkey, or Lakera and feel the security gap.
>
> P.S. — If you upvote, I will personally send you a 5-minute Loom walkthrough of whatever feature you're most curious about. DM me.

---

## Launch Day Checklist

### 24 Hours Before

- [ ] Schedule Product Hunt post for 00:01 PST
- [ ] Prepare Twitter thread (7 tweets)
- [ ] Prepare LinkedIn post
- [ ] Notify early supporters via email
- [ ] Test website load at expected traffic spike

### Launch Day (00:00–12:00 PST)

- [ ] 00:01 — Go live on Product Hunt
- [ ] 00:05 — Post Twitter thread
- [ ] 00:10 — Post LinkedIn
- [ ] 00:15 — Share in relevant Slack/Discord communities
- [ ] 00:30 — Respond to every PH comment within 15 minutes
- [ ] 01:00 — Email personal network
- [ ] 03:00 — First analytics check ( bounce rate, conversion)
- [ ] 06:00 — Mid-morning Twitter reminder post
- [ ] 12:00 — Half-day status check, reply to all comments

### Launch Day (12:00–24:00 PST)

- [ ] 12:00 — Post "behind the scenes" thread (build journey)
- [ ] 15:00 — Share in Hacker News "Show HN"
- [ ] 18:00 — Evening Twitter engagement round
- [ ] 21:00 — Final push — ask friends for last upvotes
- [ ] 23:59 — Celebrate regardless of rank

### Day After

- [ ] Thank every commenter individually
- [ ] Export email signups
- [ ] Send personal thank-you to top 20 upvoters
- [ ] Analyze traffic sources
- [ ] Write retrospective blog post

---

## Twitter Thread (7 Tweets)

**Tweet 1 (Hook):**

> I built an open-source security platform for AI agents after watching a client leak PII to an LLM because their "observability tool" only logged latency.
>
> Today it launches on @ProductHunt.
>
> Here's why Rakshex is different 🧵

**Tweet 2 (Problem):**

> Most AI security tools fall into two traps:
>
> 1. They only observe (Helicone, Portkey) — no blocking
> 2. They only block (Lakera) — no cost visibility
>
> Rakshex does both. Security + cost + compliance. One stack.

**Tweet 3 (Security):**

> Prompt injection? 50+ payload patterns detected in real time.
>
> Shadow APIs? Automatic discovery of undocumented endpoints.
>
> Credential leaks? Scan every Postman collection before it hits prod.
>
> PII? Redacted before it reaches any third-party model.

**Tweet 4 (Cost):**

> The kill switch is brutal and beautiful.
>
> Set a monthly LLM budget. One runaway script tries to blow it? Traffic HARD STOPS. Not a Slack alert. Actually stops.
>
> Works across OpenAI, Anthropic, Gemini, Cohere, Mistral, Groq.

**Tweet 5 (Compliance):**

> PCI DSS. OWASP. SOC 2.
>
> Every finding auto-mapped to the control it violates. Auditors love it. Engineers don't have to manually build compliance reports anymore.

**Tweet 6 (Open Source):**

> It's open-source. Self-host in 10 minutes with Docker Compose.
>
> Indian data residency? Check. EU? Check. Air-gapped? Check.
>
> No $50K enterprise contract required.

**Tweet 7 (CTA):**

> Live on @ProductHunt now.
>
> If you ship AI to production, I'd genuinely appreciate your feedback.
>
> 👉 [Product Hunt Link]
>
> (DM me for a personal 5-min Loom walkthrough of any feature)

---

## LinkedIn Post

> After 6 months of solo building in Bangalore, I'm launching Rakshex on Product Hunt today.
>
> Rakshex is an open-source platform that secures, monitors, and governs production AI agents. Think: prompt injection detection + cost anomaly alerts + PCI DSS compliance reporting + a kill switch that actually stops traffic — all in one stack.
>
> Why I built it: A client leaked PII to a third-party LLM because their observability tool only logged latency, not content. That incident cost them a compliance audit and 3 weeks of engineering time. Existing tools were either observability-only (Helicone, Portkey) or security-only (Lakera). No one did both.
>
> Key features:
> 🔒 Prompt injection + shadow API + credential leak scanning
> 💰 Per-request cost tracking across 6 LLM providers
> 🛑 Hard kill switch + budget caps
> 📋 Auto-mapped PCI DSS / OWASP / SOC 2 findings
> 🏠 Self-hosted with Docker Compose (10 min setup)
> 🔌 VS Code extension + GitHub Action
>
> 4 patents pending. Built by 1 person. Open source forever.
>
> If your team ships AI to production, I'd love your feedback. Link in comments.

---

## Communities to Share

- Hacker News ("Show HN: Rakshex — open-source AI agent security")
- Reddit r/MachineLearning (if allowed)
- Reddit r/webdev
- Indie Hackers
- Dev.to
- LinkedIn personal + company page
- Twitter/X personal + company
- Rakshex Discord (if exists)
- Relevant Slack communities (AI Engineers, MLOps, etc.)
