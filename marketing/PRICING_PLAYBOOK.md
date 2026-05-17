# Pricing Negotiation Playbook

Internal guide for DevPulse sales team and founders. Use these frameworks for Pro → Enterprise upgrades and custom deals.

---

## Pricing Philosophy

**Anchor high, justify with value, discount with commitment.**

- Pro is intentionally affordable ($99/mo) to reduce friction
- Enterprise is intentionally custom to capture value from large teams
- Never discount Pro — it undermines the anchor
- Always offer annual billing for 2 months free (17% effective discount)

---

## The 4 Buyer Archetypes

### 1. The Skeptical Engineer

**Profile:** "I can build this myself in a weekend."
**Response:** "You absolutely can build prompt injection detection. But maintaining 50+ payload patterns, shadow API discovery, and PCI DSS mappings across 4 engineers is 2–3 months of work. DevPulse costs $99. Your team's time costs $75/hr."
**Tactic:** ROI calculator. Show engineer-hours saved.

### 2. The Budget-Conscious Manager

**Profile:** "My CEO won't approve another tool."
**Response:** "DevPulse replaces 3+ tools. If you are paying for Helicone ($200/mo) + Lakera ($500/mo) + a compliance consultant ($2K/mo), DevPulse at $99 replaces all three."
**Tactic:** Consolidation savings. Show tool replacement math.

### 3. The Risk-Averse CISO

**Profile:** "We need SOC 2, penetration tests, and an SLA."
**Response:** "Enterprise includes SOC 2 attestation support, annual pen test reports, 99.9% SLA with service credits, and a DPA. All included."
**Tactic:** Security package. Lead with compliance and audit readiness.

### 4. The Price-Sensitive Startup

**Profile:** "We are pre-revenue."
**Response:** "Free tier is unlimited for individuals. When you hit 5 team members or need compliance, Pro is $99. Most startups upgrade at Series A when investors ask about security."
**Tactic:** Future-proofing. Position as "when you grow, we grow."

---

## Negotiation Frameworks

### Framework 1: The Triple

1. **List price:** State the standard price confidently
2. **Value justification:** Show the ROI (usually 10–50×)
3. **Conditional discount:** Only for annual commitment or multi-year

**Example:**

> "Enterprise is typically $12K/year for teams under 50. Based on your $50K/month LLM spend and 2 incidents last year, DevPulse saves you roughly $80K annually. If you commit to annual billing, we can do $10K/year — that's 2 months free."

### Framework 2: The Alternatives Close

> "Your options are:
>
> 1. **Status quo:** Continue with observability-only tools, handle security incidents reactively, manually build compliance reports. Cost: $X in incidents + $Y in engineer time.
> 2. **Build internally:** 2–3 engineers × 3 months = $80K+ in salary, plus ongoing maintenance.
> 3. **DevPulse:** $99/mo Pro or custom Enterprise. Operational in 1 day.
>
> Which option makes the most sense for your timeline?"

### Framework 3: The Trial Close

> "Instead of debating price, let's run a 14-day pilot. You import one collection, run one scan, and see the findings your current stack missed. If it doesn't surface at least one critical issue you didn't know about, we will extend the trial another 14 days."

---

## Discounting Rules

| Situation                       | Max Discount        | Condition                          |
| ------------------------------- | ------------------- | ---------------------------------- |
| Annual billing (Pro)            | 17% (2 months free) | Must pay upfront                   |
| Annual billing (Enterprise)     | 20%                 | 12-month commitment                |
| Multi-year (Enterprise)         | 25%                 | 24-month commitment                |
| Non-profit / education          | 50%                 | Valid documentation required       |
| Open-source project             | 100% (free)         | Must be publicly maintained        |
| Strategic customer (case study) | 30%                 | Agrees to public case study + logo |

**Never:**

- Discount month-to-month billing
- Offer lifetime deals
- Compete on price with hobbyist tools
- Give custom pricing without a discovery call

---

## Enterprise Pricing Calculator

Use this internal formula for Enterprise quotes:

```
Base: $12,000/year
+ Per seat: $240/year (first 20 included)
+ LLM spend factor: +$2,400/year per $10K monthly LLM spend
+ Compliance add-on: +$6,000/year (SOC 2 support, pen test reports)
+ Custom integration: $5,000–$15,000 one-time
+ On-premise / air-gapped: +$12,000/year
```

**Example:** 30-engineer team, $30K/mo LLM spend, needs SOC 2, on-premise:

- Base: $12,000
- Seats: (30 − 20) × $240 = $2,400
- LLM factor: 3 × $2,400 = $7,200
- Compliance: $6,000
- On-premise: $12,000
- **Total: $39,600/year** → quote $42K, settle at $39K

---

## Handling "Too Expensive"

**If Pro ($99/mo):**

> "What is the cost of one security incident at your company? If DevPulse prevents one credential leak or one prompt injection, it pays for itself 100× over."

**If Enterprise:**

> "Let's scope this. What is your monthly LLM spend, team size, and compliance requirements? I can build a custom quote that maps directly to your ROI."

**If free user:**

> "Free tier is unlimited for individuals. When you are ready to invite your team or need compliance reporting, Pro is here. No rush."

---

## Competitor Pricing Intel

| Competitor | Pricing                     | DevPulse Advantage                    |
| ---------- | --------------------------- | ------------------------------------- |
| Helicone   | $0–$500+/mo (per-request)   | Flat fee, security included           |
| Portkey    | $0–$1,000+/mo (per-request) | Flat fee, kill switch included        |
| Lakera     | $0.001/request              | Flat fee, API security included       |
| Snyk       | $52–$300+/seat/mo           | Purpose-built for AI, not code        |
| Datadog    | $15–$70+/host/mo            | AI-specific findings, not generic APM |

**Key message:** "We are not cheaper. We are better value because we replace multiple tools."

---

## Closing Techniques

1. **The assumptive close:** "Shall we start with the annual Pro plan or do you need Enterprise features?"
2. **The summary close:** "You need prompt injection defense, PCI DSS reporting, and a kill switch. DevPulse does all three for $99/mo. Shall we get you set up?"
3. **The urgency close:** "We are offering 20% off annual Enterprise through end of quarter. Would locking that in now work for your budget cycle?"
4. **The post-close:** After signature, immediately schedule onboarding call within 48 hours. Momentum matters.
