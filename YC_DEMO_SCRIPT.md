# Rakshex — YC Demo Script

> 3-minute demo for YC application and investor pitches.
> Date: 2026-05-17

---

## THE HOOK (0:00 - 0:30)

**[Screen: VS Code with a simple API call to OpenAI]**

> "Every developer building with AI is bleeding money and exposing secrets — and they don't even know it.
>
> Hidden reasoning tokens cost 3x more than visible ones. API keys leak in Postman collections. Shadow APIs appear overnight.
>
> I'm Akshay, and we built Rakshex — the first security platform that sits between your code and AI providers, protecting you from risks you can't see."

---

## PROBLEM (0:30 - 1:00)

**[Screen: Split view — normal API call cost vs actual cost with reasoning tokens]**

> "Here's a real problem. This API call to GPT-4 looks like it costs $0.02.
> But with hidden reasoning tokens, it actually costs $0.06. That's 3x more.
> Across 10,000 requests a day, that's $600 in invisible costs.
>
> And that's just the money. What about the API key embedded in this Postman collection you shared with your team last week? Or the shadow endpoint that appeared when your junior dev pushed to production?"

---

## SOLUTION (1:00 - 1:45)

**[Screen: Rakshex VS Code extension — scan results panel]**

> "Rakshex is three things in one:
>
> **One:** Import any collection — Postman, OpenAPI, or Bruno — and we scan it for leaked secrets, exposed PII, and missing auth before it hits production.
>
> **Two:** Our AgentGuard watches every LLM call in real-time. Infinite loop? Kill switch. Cost spike? Alert. Prompt injection? Blocked.
>
> **Three:** We attribute hidden reasoning costs to specific API calls — the first platform to do this."

**[Screen: Click on a finding → inline fix suggestion → apply → commit]**

> "And because we're inside VS Code, remediation is one click away. No context switching. No dashboard hunting."

---

## DEMO (1:45 - 2:30)

**[Screen: Live demo — 45 seconds]**

1. **Import collection:** "I'll import this Postman collection..."
2. **Scan:** "Rakshex found 2 leaked API keys and a missing auth header."
3. **Fix inline:** "Click fix — the key is rotated and the header is added."
4. **View cost:** "Here's the cost breakdown — visible vs hidden reasoning tokens."
5. **Enable AgentGuard:** "Now AgentGuard is active. If anything anomalous happens, it stops automatically."

---

## TRACTION & MARKET (2:30 - 2:50)

**[Screen: TAM/SAM/SOM slide]**

> "Market size:
>
> - **TAM:** $50B — Developer tools + API security + AI infrastructure
> - **SAM:** $5B — API security and LLM cost management
> - **SOM:** $500M — Developer-first security in the AI era
>
> We're targeting the 30 million developers worldwide building with LLMs."

---

## CLOSING (2:50 - 3:00)

**[Screen: Rakshex logo + contact]**

> "Rakshex is the security layer every AI application needs but nobody has built yet.
>
> We're live in beta, 500 developers on the waitlist, and raising our seed round.
>
> Thank you."

---

## BACKUP SLIDES

### Slide A: Architecture

- VS Code extension (client)
- tRPC API (Node.js + Express)
- MySQL + Redis + BullMQ
- OpenTelemetry + Sentry

### Slide B: Competitive Matrix

|             | Snyk    | Datadog | Portkey | **Rakshex** |
| ----------- | ------- | ------- | ------- | ----------- |
| IDE-native  | Partial | No      | No      | **Yes**     |
| LLM-aware   | No      | No      | Yes     | **Yes**     |
| Cost intel  | No      | No      | Partial | **Yes**     |
| Kill-switch | No      | No      | No      | **Yes**     |

### Slide C: Team

- **Akshay** — Security Lead, ex-Flipkart security
- **Engineering team** — Staff+ engineers from Stripe, Snyk

### Slide D: Ask

- **Raising:** $2M seed
- **Use of funds:** 50% engineering, 30% GTM, 20% infrastructure
- **Milestone:** 5,000 active developers in 12 months

---

## DELIVERY NOTES

1. **Practice until it's muscle memory.** 3 minutes is short.
2. **Show, don't tell.** Live demo > slides.
3. **Energy matters.** This is a security product — make it exciting, not dry.
4. **Anticipate questions:**
   - "How do you differentiate from Snyk?" → IDE-native + LLM-aware
   - "What's your moat?" → Workflow lock-in + patent pending
   - "How do you make money?" → Freemium, $29 Pro, $99 Enterprise

---

_Script prepared for YC W26 batch application._
