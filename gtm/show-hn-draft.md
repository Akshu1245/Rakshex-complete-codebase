# Show HN Draft — RaksHex

**Status:** DRAFT. Do not post until boss approves copy AND supplies the incident story (marked below).
**Honesty constraints (from repo AGENTS.md):** private beta, uncertified, pre-revenue, no production deployment. No invented users, metrics, traction, pilots, revenue, waitlist, or testimonials. Enforcement covers RaksHex-routed/SDK-wrapped traffic only. Do not quote the old "874 tests" number.

---

**Title:** Show HN: RaksHex – an action firewall for AI agents, with signed receipts

**Body:**

> [INSERT: boss's real incident story — 2–4 sentences, first person. The moment an agent did something (or nearly did) it shouldn't have, with a real key, and there was no proof of what was allowed. This is the highest-leverage paragraph in the post. Do NOT invent one — if there's no story yet, use a partner's with permission, or cut this block and lead with the problem.]

AI agents now hold live API keys and take consequential actions — refunds, emails, code deploys, data reads. The tooling around them answers "where are your keys?" (vaults) or "how much did you spend?" (dashboards). Nobody answers the question that matters after an incident: **prove this agent was allowed to do that.**

RaksHex is an action control plane — an agent firewall. The flow:

1. The agent proposes a semantic action (`financial.refund`, `email.send`).
2. RaksHex checks delegated authority and evaluates policy **before** anything executes. Decision: ALLOW / DENY / APPROVAL_REQUIRED / LIMIT / PAUSE / FREEZE.
3. The agent never holds the secret. A fail-closed broker releases a credential for that one action only, then takes it back.
4. Every decision emits a hash-chained, Ed25519-signed receipt you can verify offline — years later, without trusting us.

What it is not: a vault, a cost dashboard, or a kill switch for traffic that bypasses it. Enforcement covers RaksHex-routed or SDK-wrapped traffic only — I'll say that upfront because the bypass question always comes up.

Honest status: private beta, pre-revenue, uncertified. Onboarding today is a monorepo clone and too many steps — we're actively rebuilding it into a 3-question hosted signup, and I'd rather tell you that than pretend otherwise. Receipt signing and verification will always be free; it's the trust moat, not the paywall.

What I'd actually like from HN: we're looking for ~10 design partners running agents against real APIs (support agents, ops agents, coding agents) for a free private beta. And I'd like the red team to try to break the receipt story — if you can forge or fork the chain, I want to know.

Demo: [link to the 90-second faceless demo once recorded]
Docs: [rakshex.in link]

---

**Posting notes:**
- Post Tuesday–Thursday morning IST-friendly window; be present in comments for 4+ hours.
- Answer the bypass question with the honest boundary (routed traffic only) — don't get defensive, it's the right question.
- Never engage "how many users" bait with invented numbers. The true answer is "private beta, single digits, that's why we're here."
