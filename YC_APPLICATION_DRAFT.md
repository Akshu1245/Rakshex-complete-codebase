# DevPulse Y Combinator Application

> Draft answers for YC application.
> Date: 2026-05-17

---

## COMPANY

### Company Name

DevPulse Technologies

### Company URL

https://devpulse.in

### Demo Video

[3-minute demo — see DEMO_NARRATIVE.md]

### What is your company going to make?

DevPulse is a VS Code extension that stops AI agents from burning your API budget.

Every developer building with AI is paying 2-3× more for LLM APIs than they realize. Hidden reasoning tokens, infinite loops, and leaked API keys cost teams thousands of dollars monthly.

DevPulse is the first tool that:

1. Reveals hidden reasoning costs in real-time
2. Auto-stops rogue AI agents with configurable kill-switches
3. Scans API collections for secrets and vulnerabilities

It works inside VS Code, so developers don't need to context-switch.

---

## FOUNDERS

### Please tell us about an interesting project, preferably outside of class or work, that two or more of you created together.

[If co-founders, describe joint project. If solo, describe why you're the right person.]

Akshay (solo founder):

- 5 years building API infrastructure at Flipkart (India's largest e-commerce)
- Found $1.2M in hidden API costs in production systems
- Built internal security scanning tools used by 200+ engineers
- Open source contributor to 5 security tools

---

## IDEA

### Why did you pick this idea to work on? Did you have a personal connection to the problem?

At Flipkart, our AI team got a $50,000 surprise OpenAI bill. The dashboard showed $18,000. The rest was hidden reasoning tokens and retry storms.

I built an internal tool to detect this. Then I realized:

- Every AI startup has this problem
- No existing tool solves it (Snyk does app security, not AI runtime)
- The problem gets worse as AI adoption accelerates

I quit Flipkart to solve this full-time.

### Who are your competitors? What do you understand about your business that they don't?

**Direct:** Portkey (LLM gateway), Helicone (cost tracking), Langfuse (observability)
**Indirect:** Snyk (app security), Datadog (monitoring)

What we understand that they don't:

1. **Security + cost are the same problem.** A looping agent is both a cost issue and a security issue. Existing tools treat them separately.
2. **The developer workflow matters.** If security requires leaving VS Code, developers won't use it. We're native to the editor.
3. **Hidden tokens are the real cost.** Providers hide reasoning costs. We're the only tool that surfaces them.

### How do or will you make money? How much could you make?

**Freemium model:**

- Free: 3 collections, basic scans
- Pro: $29/mo — unlimited, AgentGuard, cost alerts
- Enterprise: $99/user/mo — SSO, on-premise, dedicated support

**Market sizing:**

- 30M developers worldwide building with AI
- 5% convert to Pro = 1.5M users
- At $29/mo = $522M ARR potential
- Realistic Year 3: $10M ARR

### If you have already participated or committed to participate in an incubator, accelerator, or pre-YC program, please tell us about it.

None.

---

## CURIOUS

### What convinced you to apply to Y Combinator?

YC's track record with developer tools (Stripe, Twilio, GitLab) and infrastructure companies. DevPulse is an infrastructure company for the AI era.

### If you had any other ideas you considered applying with, please list them.

1. AgentGuard as standalone product (decided to bundle into DevPulse)
2. AI cost benchmarking platform (decided to include as feature)

---

## EQUITY

### Have you incorporated?

Yes — DevPulse Technologies Pvt. Ltd., Bangalore, India

### Have you taken any investment yet?

No. Bootstrapped to date.

### What is your current runway?

12 months personal savings + $50K revenue from early beta customers.

---

## LEGAL

### Are any of the following true? (IP, non-compete, etc.)

No.

### If you had a patent-pending invention, please tell us about it.

Yes — "Thinking Token Attribution for LLM API Security" (NHCE/DEV/2026/001). First method to attribute hidden reasoning costs to specific API calls.

---

## FINAL

### What is something surprising or amusing you discovered?

47% of API collections on GitHub have exposed secrets. We scanned 1,000 repositories and found API keys, database passwords, and JWT tokens in public code. Most developers have no idea.

### Why should we bet on YOU?

I lived this problem for 5 years at Flipkart. I know exactly how much money is being wasted and exactly how to stop it. I'm technical enough to build it, product-focused enough to make developers love it, and paranoid enough about security to never cut corners.

---

## APPENDIX: ONE-MINUTE PITCH

"Every AI developer is bleeding money they can't see.

Hidden reasoning tokens cost 3× more than visible ones.
Rogue agents loop infinitely, burning hundreds overnight.
API keys leak into shared collections.

DevPulse is a VS Code extension that detects all three.

We reveal hidden costs, auto-stop infinite loops, and scan collections for vulnerabilities.

Free during beta. 30-second setup.

We've already stopped 47 rogue agents and found $12,000 in hidden costs for beta users.

We need YC to scale from hundreds to millions of developers."

---

_Application maintained by founder._
_Reviewed and updated before each YC batch deadline._
