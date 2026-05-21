# Getting Started with Rakshex

Go from zero to first security scan in under 5 minutes.

---

## Prerequisites

- Node.js 20+ and pnpm
- Docker (for database and Redis)
- A Rakshex account (free at [rakshex.in](https://rakshex.in))

---

## Option 1: Cloud (Fastest — 2 minutes)

1. **Create an account** at [rakshex.in/register](https://rakshex.in/register)
2. **Verify your email** — check inbox for confirmation link
3. **Log in** at [rakshex.in/login](https://rakshex.in/login)
4. **Import your first collection:**
   - Go to **Collections** → **Import Collection**
   - Drop a Postman collection or OpenAPI spec
   - Rakshex automatically scans for credential leaks
5. **Run your first scan:**
   - Click **Scan** on any collection
   - Choose **Full Scan** for comprehensive analysis
   - Results appear in 30–120 seconds

---

## Option 2: Self-Hosted (10 minutes)

```bash
# 1. Clone
git clone https://github.com/Akshu1245/rakshex-complete-codebase.git
cd rakshex-complete-codebase

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (MySQL + Redis)
docker compose up -d

# 4. Copy environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, and at least one LLM API key

# 5. Run migrations
pnpm run db:migrate

# 6. Start the app
pnpm run dev

# 7. Open http://localhost:3000 and create an admin account
```

---

## Your First 5 Minutes

### Minute 1: Import a Collection

Navigate to **Collections** and import a Postman or OpenAPI file. Rakshex immediately:

- Parses endpoints, methods, and parameters
- Scans for hardcoded secrets (AWS keys, Stripe tokens, database passwords)
- Flags any credential findings with severity and remediation

### Minute 2: Run a Security Scan

Click **Scan** on your imported collection. The scan checks for:

- **Shadow APIs** — endpoints not documented in your spec
- **Authentication gaps** — missing auth headers on sensitive routes
- **PII exposure** — fields that might leak personal data
- **Injection risks** — query parameters vulnerable to SQL/NoSQL injection

### Minute 3: Review Findings

The **Findings** tab shows:

- Severity (Critical / High / Medium / Low)
- Affected endpoint and line number
- Description of the issue
- Remediation steps with code examples

Click any finding to see the full request/response context.

### Minute 4: Set a Policy Rule

Go to **Policies** → **Create Rule**:

```
Name: Block GPT-4 on production
Condition: model equals "gpt-4o"
Action: require_approval
```

Now any production request to GPT-4o requires manual approval before execution.

### Minute 5: Enable the Kill Switch

Go to **Kill Switch** and set a monthly LLM budget:

```
Budget Limit: $1,000 USD
Alert at: 80% ($800)
```

If any runaway script tries to blow the budget, Rakshex hard-stops traffic and alerts via Slack, email, and webhook.

---

## Next Steps

| Goal               | Action                                                          |
| ------------------ | --------------------------------------------------------------- |
| Connect VS Code    | Install the Rakshex extension from the VS Code marketplace      |
| Add CI/CD security | Add the Rakshex GitHub Action to your repository                |
| Invite your team   | Go to **Team** → **Invite Members**                             |
| Set up alerts      | Go to **Alerts** → **Create Rule** for Slack or email           |
| View costs         | Go to **Token Analytics** for per-model spend breakdown         |
| Compliance report  | Go to **Compliance** → **Generate Report** for PCI DSS or OWASP |

---

## SDK Integration (1 line of code)

### JavaScript / TypeScript

```bash
npm install @rakshex/sdk
```

```typescript
import { Rakshex } from "@rakshex/sdk";

const dp = new Rakshex({ apiKey: "dp_your_key_here" });

// This single call does: routing, security scan, cost tracking, PII redaction
const result = await dp.llm.invoke({
  model: "gpt-4o",
  messages: [{ role: "user", content: userInput }],
});
```

### Python

```bash
pip install rakshex
```

```python
from rakshex import Rakshex

dp = Rakshex(api_key="dp_your_key_here")

result = dp.llm.invoke(
    model="gpt-4o",
    messages=[{"role": "user", "content": user_input}]
)
```

### Express.js Middleware

```typescript
import { rakshexMiddleware } from "@rakshex/sdk/express";

app.use(
  "/api/llm",
  rakshexMiddleware({
    apiKey: process.env.RAKSHEX_API_KEY,
    budgetLimitUSD: 1000,
    blockPromptInjection: true,
    redactPII: true,
  }),
);
```

---

## Need Help?

- **Docs:** [docs.rakshex.in](https://docs.rakshex.in) (coming soon)
- **Discord:** [discord.gg/rakshex](https://discord.gg/rakshex) (coming soon)
- **Email:** support@rakshex.in
- **GitHub Issues:** [github.com/Akshu1245/rakshex-complete-codebase/issues](https://github.com/Akshu1245/rakshex-complete-codebase/issues)
