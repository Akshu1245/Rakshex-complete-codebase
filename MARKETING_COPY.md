# RaksHex Launch Marketing Copy

## 1. Twitter/X Post

```
I scanned my API with @RaksHex and found 7 security issues in 10 seconds.

Including:
- 2 hardcoded API keys
- 1 CORS misconfiguration
- Missing auth on 3 endpoints

Postman is dying. API security shouldn't be an afterthought.

Try it free: https://rakshex.in/demo

#APISecurity #DevTools #InfoSec
```

## 2. Reddit r/netsec Post

```
[Tool] I built a free API security scanner that finds vulns in Postman collections in 10 seconds

Hey r/netsec,

After seeing 30,000 Postman workspaces leak live API keys last month, I built RaksHex — a security scanner that checks your API definitions for:

- Hardcoded secrets & API keys
- Missing authentication on endpoints
- CORS misconfigurations
- Shadow APIs (undocumented endpoints)
- LLM cost anomalies (if you're using AI APIs)

It works by importing your Postman collection or OpenAPI spec and running OWASP-style checks locally.

**What makes it different:**
- Scans the API DEFINITION, not just the live endpoint
- Finds issues before you deploy (shift-left)
- 100% free for individual developers

Demo: https://rakshex.in/demo

Would love feedback from the community. What checks should we add next?
```

## 3. LinkedIn Outreach — Fintech CTO Template

```
Hi [Name],

I noticed [Company] is scaling its API infrastructure — congrats on the growth.

Quick question: how are you catching security issues in API changes before they hit production?

We built RaksHex after seeing 30,000 Postman workspaces leak live API keys. It scans Postman/OpenAPI collections for:
- Hardcoded secrets
- Missing auth
- CORS misconfigs
- Shadow APIs

Takes 10 seconds. Free for dev teams under 5.

Worth a 5-minute demo? https://rakshex.in/demo

Best,
Akshay
```

## 4. Blog Post: "I Scanned a Postman Collection and Found 7 Security Issues in 10 Seconds"

````
# I Scanned a Postman Collection and Found 7 Security Issues in 10 Seconds

Last week, I ran a security scan on a typical fintech API collection. Here's what I found.

## The Setup

- **Collection:** 47 endpoints (user auth, payments, webhooks)
- **Tool:** RaksHex free scanner
- **Time:** 10.3 seconds

## The Findings

### 1. Hardcoded API Key in Environment Variable (Critical)
```json
"value": "sk_live_51H7xJ..."
````

A Stripe live key was sitting in a shared Postman environment. Anyone with collection access could see it.

### 2. CORS Allow-Origin: \* (High)

Three endpoints returned `Access-Control-Allow-Origin: *` without credential restrictions.

### 3. Missing Auth on Webhook Endpoints (High)

`/webhooks/payment-success` had no API key or signature validation. Anyone could POST fake payment events.

### 4. Debug Endpoint Exposed (Medium)

`/debug/config` returned full server configuration including database connection strings.

### 5-7. HTTP Instead of HTTPS (Medium)

Three internal service calls used plain HTTP on non-localhost URLs.

## Why This Matters

Postman's free tier collapse means teams are scrambling. But moving collections isn't enough — you need to know what's IN them.

## Try It Yourself

Upload your collection: https://rakshex.in/demo

Takes 10 seconds. No signup required.

```

## 5. HackerNews Show HN Title

```

Show HN: RaksHex – API security scanner that finds vulns in Postman collections in 10s

```

Body:
```

Hi HN,

After seeing 30,000 Postman workspaces leak live API keys last month (including Razorpay and New Relic credentials), I built RaksHex.

It's a security scanner for API definitions. Instead of penetration testing live endpoints, it analyzes your Postman collection or OpenAPI spec and finds issues before deployment:

- Hardcoded secrets & API keys
- Missing auth on endpoints
- CORS misconfigurations
- Shadow APIs (code routes not in your spec)

Demo: https://rakshex.in/demo — upload a collection, get results in 10s.

Tech stack: TypeScript, PostgreSQL, tRPC, Next.js, deployed on Railway + Vercel.

What security checks should we add next?

```

## 6. Product Hunt Launch Copy

**Tagline:** API security scanner that finds vulnerabilities before you deploy

**Description:**
RaksHex scans your Postman collections and OpenAPI specs for security issues in 10 seconds. Find hardcoded secrets, missing auth, CORS misconfigs, and shadow APIs before they reach production.

**Key features:**
- Import Postman / OpenAPI / Bruno collections
- Detect secrets, auth gaps, CORS issues
- Find shadow APIs (routes in code but not in spec)
- VS Code extension for in-IDE scanning
- Free for individual developers

**Maker comment:**
```

I built RaksHex after seeing 30,000 Postman workspaces leak live API keys last month. The Postman exodus is real — teams are moving collections but not checking what's IN them.

RaksHex fixes that by scanning API definitions (not just live endpoints) so you catch issues before deployment.

The VS Code extension lets you scan from your editor. The GitHub Action posts findings as PR comments.

Happy to answer questions!

```

```
