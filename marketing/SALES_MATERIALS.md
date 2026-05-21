# Rakshex — Marketing & Sales Materials

## Cold Outreach Email Templates

### 1. CTO/CISO Cold Email

**Subject:** Your AI agents have security blind spots

Hi {firstName},

I noticed {company} is building with LLMs. Are you tracking:

1. Which endpoints your AI agents actually call?
2. How much each feature spends on tokens (not just the total)?
3. Whether any prompt injection payloads are getting through?

Most teams I talk to can't answer these. They're shipping fast with AI and the security/cost surface is invisible until something breaks.

I'm building Rakshex — an AI Runtime Governance Platform that scans your API surface, tracks LLM costs per endpoint, and blocks prompt injection in real time. It sits inside your VS Code and CI/CD, not another dashboard to check.

**Quick numbers from our existing users:**

- 30% reduction in LLM spend (per-endpoint attribution reveals waste)
- 87 prompt injection payloads blocked in production
- 3 seconds to find exposed credentials in any Postman collection

Would you be open to a 20-minute demo? I'll show you your blind spots live — no commitment needed.

Best,
{yourName}
Founder, Rakshex

---

### 2. VP Engineering Cold Email

**Subject:** Postman killed their free tier — here's what to do

Hi {firstName},

Postman's March 2026 decision killed the free tier for 500,000 companies. Teams are scrambling to find alternatives.

Rakshex is a direct replacement that adds security scanning + LLM cost monitoring on top of API collections. You import your existing Postman/OAI collections and get:

- Security findings mapped to OWASP + PCI DSS
- Credential leak detection (AWS keys, API keys, JWT)
- LLM cost attribution per endpoint
- Kill switch for runaway agents

**Our VS Code extension does what Postman can't — scans your APIs right where you code.**

We're offering a special migration program for teams leaving Postman: free collection import + 30-day Pro trial.

Want to see it in action? rakshex.in/demo — no signup needed.

Best,
{yourName}

---

### 3. Follow-up (3 days after first email)

**Subject:** Re: Quick question about your AI security

Hi {firstName},

Just circling back — I know inboxes get crazy.

One thing I've heard from {similarCompany} teams: the real panic moment is finding an OpenAI key hardcoded in a Postman collection that's been public for 6 months.

Our demo at rakshex.in/demo takes 3 seconds. Drop any Postman JSON and you'll see every secret, every insecure endpoint, and your actual risk score. No signup.

If you try it and hate it, I'll stop emailing you. Fair?

Best,
{yourName}

---

## Enterprise Demo Script (5 minutes)

### Minute 1: The Hook

> "41% of all code in 2026 is AI-generated. That code has API endpoints. Those endpoints have vulnerabilities. Nobody is reviewing them. Rakshex automates that review."

### Minute 2: The Scan

> Open dashboard → Import Postman collection → Watch findings appear in 3 seconds. Show credential leak (fake one). Show risk score dropping from 95 → 30.

### Minute 3: The Cost Revelation

> Switch to Token Analytics tab. Show per-model breakdown. "This /chat endpoint burns 73% of your budget on reasoning tokens. Here's what that costs you."

### Minute 4: The Kill Switch

> Show kill switch settings → Set budget to $1 → Watch LLM traffic get blocked → Show Slack notification. "This is your circuit breaker."

### Minute 5: The Ask

> "We have 478+ tests, 4 patents, and 18 migrations. This is production-grade code built by a team that ships. We need ₹15 lakhs to capture the Postman migration window. The window is open now. It closes in 12-18 months."

---

## Investor FAQ

**Q: Why now?**
A: Postman killed their free tier (March 2026). 500,000 companies need alternatives. AI-generated API surfaces are exploding with no security review. LLM costs are unpredictable without attribution.

**Q: What's your moat?**
A: 4 patents (thinking token attribution is first-in-world). Combined API security + LLM cost in one platform. VS Code integration (73% of developers live there). India cost structure (15-20% of US).

**Q: Who's the competition?**
A: Nobody does what we do. Helicone does observability. Snyk does code security. Postman does API testing. We do API + AI governance in one workflow.

**Q: How do you acquire users?**
A: Zero-auth demo → emotion trigger (exposed keys) → signup → VS Code install → GitHub Action install → team adoption. Viral CI/CD spread within orgs.

**Q: What's your biggest risk?**
A: Execution speed. The Postman window is 12-18 months. We need capital to move faster.
