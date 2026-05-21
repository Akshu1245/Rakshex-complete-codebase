# Rakshex 3-Minute Demo Narrative

> The exact script for investor demos, Product Hunt videos, and YC interviews.
> Date: 2026-05-17

---

## THE HOOK (0:00 - 0:15)

**[Screen: VS Code with Rakshex sidebar open]**

> "Every developer building with AI is paying 2-3× more for LLM APIs than they realize.
>
> I'm Akshay, founder of Rakshex. We built the first tool that stops AI agents from burning your API budget."

---

## PROBLEM DEMONSTRATION (0:15 - 0:45)

**[Screen: OpenAI dashboard showing $0.02 per call]**

> "Here's a GPT-4 API call. The dashboard says it costs $0.02.
>
> But with hidden reasoning tokens, it actually costs $0.06. That's 3× more.
>
> Across 10,000 calls a day, that's $400 in invisible costs."

**[Screen: Switch to rogue agent scenario]**

> "And that's just the money. What about the agent that recursively called itself for 6 hours?
>
> Cost: $247. Detection: zero."

---

## SOLUTION OVERVIEW (0:45 - 1:15)

**[Screen: Rakshex VS Code extension — welcome view]**

> "Rakshex is a VS Code extension that protects you from three things:
>
> One: Hidden cost detection. We attribute every API call to its real cost — including reasoning tokens providers hide.
>
> Two: AgentGuard. Auto-stops infinite loops and cost spikes in real-time.
>
> Three: Security scanning. Import any collection, find vulnerabilities in seconds."

---

## LIVE DEMO (1:15 - 2:15)

**[Screen: Live demo — 60 seconds of actual usage]**

### Step 1: Import Collection (10s)

> "I'll import this Postman collection..."
> [Drag collection into sidebar]

### Step 2: Run Scan (15s)

> "Rakshex found 6 issues: 1 Critical, 2 High, 2 Medium, 1 Low."
> [Click scan, results appear]

### Step 3: Show Hidden Cost (15s)

> "Look at the cost breakdown — visible vs hidden reasoning tokens. This endpoint costs 3× more than the dashboard shows."
> [Click cost tab]

### Step 4: Show AgentGuard (15s)

> "Now I'll enable AgentGuard. If anything anomalous happens, it stops automatically."
> [Toggle AgentGuard, show configuration]

### Step 5: Fix Inline (5s)

> "And because we're in VS Code, remediation is one click away."
> [Click fix on a finding, code updates]

---

## TRACTION (2:15 - 2:30)

**[Screen: Simple metrics slide]**

> "In 30 days of beta:
>
> - 500 developers using Rakshex
> - 47 rogue agents stopped
> - $12,000 in hidden costs found
> - 87% true positive rate on security scans"

---

## ASK (2:30 - 3:00)

**[Screen: Rakshex logo + contact]**

> "We're raising our seed round to scale from hundreds to millions of developers.
>
> The AI infrastructure market is exploding, and somebody needs to protect developers from the costs and risks.
>
> Rakshex is that protection.
>
> Thank you."

---

## BACKUP SLIDES

### Slide A: Architecture

- VS Code extension (client)
- Node.js API (tRPC)
- MySQL + Redis + BullMQ
- OpenTelemetry + Sentry

### Slide B: Competitive Positioning

|             | Snyk    | Datadog | Portkey | **Rakshex** |
| ----------- | ------- | ------- | ------- | ----------- |
| IDE-native  | Partial | No      | No      | **Yes**     |
| LLM-aware   | No      | No      | Yes     | **Yes**     |
| Cost intel  | No      | No      | Partial | **Yes**     |
| Kill-switch | No      | No      | No      | **Yes**     |

### Slide C: Business Model

- Free: 3 collections
- Pro: $29/mo — unlimited
- Enterprise: $99/user/mo
- Target: 5% conversion, $10M ARR Year 3

### Slide D: Team

- Akshay — Founder, ex-Flipkart security
- [Future hires: engineering, growth, design]

---

## DELIVERY NOTES

1. **Practice until muscle memory.** 3 minutes is short.
2. **Show, don't tell.** Live demo > slides.
3. **Energy matters.** Security product — make it exciting.
4. **Anticipate questions:**
   - "How do you differentiate from Snyk?" → IDE-native + LLM-aware
   - "What's your moat?" → Workflow lock-in + patent pending
   - "How do you make money?" → Freemium, $29 Pro, $99 Enterprise

---

_Demo script maintained by founder._
_Updated before every investor pitch._
