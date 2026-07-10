# DevPulse — Honest First-Prize Pitch (Real Market Build)

**One-liner:**
"DevPulse is the security + cost + observability layer for AI applications. We block prompt injections and PII leaks in real time using production engines, while giving developers full visibility into costs and shadow APIs — all in one place."

This is a real product being built for the actual market, not a hackathon throwaway.

---

## 3-Minute Pitch Structure (Use this)

**[0:00–0:20] The Real Problem**
Companies are adding AI to every product. Right now they have almost no protection.

- Prompt injection is in OWASP AI Top 10 and actively exploited.
- Developers paste customer data, API keys, and internal instructions into prompts.
- Costs are unpredictable and often 2-5x higher than necessary because of poor visibility.
- Teams end up with 4-6 different tools (routing + security + logging + cost) that don't talk to each other.

**[0:20–0:45] Our Real Solution**
DevPulse is a single platform that sits in front of (or beside) every AI call.

Real things we do today:

- Multi-layer prompt injection detection (140+ patterns + heuristics) — runs in <200ms.
- PII detection and redaction for emails, credit cards, Indian PAN/Aadhaar, API keys, etc.
- Actual extraction of hidden "thinking/reasoning" tokens from OpenAI o-series, Anthropic, Gemini so you can see true cost.
- Scan Postman collections and code for exposed secrets and broken auth patterns.
- Developer tools: VS Code extension + GitHub Action that run the same engines.

One gateway. One dashboard. One set of APIs.

**[0:45–2:00] Live Demo (The Decider)**
Go to the /demo or /demo/judge page.

1. Click "Classic DAN Jailbreak" or "PII + Secrets Leak".
2. Watch the real engine return:
   - Threat level (critical/high/medium)
   - Confidence %
   - Specific patterns matched
   - PII entities found + count
3. Paste your own prompt (e.g. one with a fake key or "ignore previous instructions").
4. Optionally upload a small Postman collection — see credential leaks and missing auth findings.

Tell the judges:
"This is not a mock. These are the exact same functions that run in our production gateway (detectSync from promptInjectionEngine + detectPII)."

**[2:00–2:40] Why This Wins in the Real Market**

- Most competitors do only one thing (security OR cost OR routing).
- We built the full stack: engines + gateway + IDE integration + CI.
- Developers get value immediately (VS Code + GitHub Action) without changing their whole stack.
- The same engines protect both the public demo and real customer traffic.

**[2:40–3:00] Close**
"We're already building this for real customers. The engines you just saw are live. We want to make DevPulse the default way safe, observable AI calls happen."

---

## Real Capabilities You Can Show (No Exaggeration)

**Prompt Injection Engine (server/engines/promptInjectionEngine.ts)**

- 140+ hardcoded jailbreak patterns (DAN, "ignore previous", roleplay attacks, system prompt leakage, indirect injection, etc.).
- Heuristic scoring.
- Returns threatLevel, confidence, detectedPatterns.

**PII Engine (server/engines/piiDetector.ts)**

- Detects: email, phone, credit_card, ssn, aadhaar, pan_card, upi_id, api_key, jwt, private_key.
- Returns hasPII, count, types, redactedText.

**Other Real Things**

- Thinking token extraction for cost (server/services/thinkingTokens.ts) — supports OpenAI, Anthropic, Gemini.
- Postman/OpenAPI collection scanner (server/utils/demoScanner.ts + client).
- VS Code extension with Postman import + secret scanning.
- GitHub Action for PR scanning.
- Full tRPC backend with auth, usage tracking, and gateway audit logging.

---

## Honest Positioning

We are early but the core technology is real and differentiated.

What judges and real customers care about:

- Does the detection actually work on real attacks? (Yes — try the examples.)
- Can developers use it without huge friction? (VS Code + GitHub Action + simple gateway.)
- Is it one platform or another fragmented tool? (One platform.)

Use the live demo to prove the first point. Use the product structure to prove the rest.

---

## Recommended Demo Flow for Judges (Real Only)

1. Open /demo/judge (or main /demo).
2. Run 2-3 example prompts from the buttons.
3. Let a judge type their own prompt.
4. Show the result clearly: "This ran through the same code that would protect a production AI endpoint."
5. If time, mention the thinking tokens feature and collection scanner as additional real capabilities.

Do not invent numbers. Show what the engine actually returns.

---

This document is kept honest on purpose. The product is being built for the real market. Use the actual running code to win.
