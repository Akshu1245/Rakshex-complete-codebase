# How Rakshex Works: Architecture Deep Dive

> Technical explanation for developers, investors, and technical writers.
> Date: 2026-05-17

---

## 1. SYSTEM OVERVIEW

Rakshex is a VS Code extension + Node.js backend that protects AI applications from:

1. Hidden LLM costs
2. Infinite agent loops
3. API security vulnerabilities

```
Developer's Machine          Rakshex Cloud
┌──────────────────┐       ┌──────────────────────────┐
│ VS Code          │◄─────►│ Node.js API (tRPC)       │
│ ├─ Sidebar       │  WS   │ ├─ Auth (JWT)            │
│ ├─ Status Bar    │       │ ├─ Scanner Engine        │
│ ├─ Security Panel│       │ ├─ AgentGuard            │
│ └─ Welcome View  │       │ ├─ Queue (BullMQ)        │
└──────────────────┘       │ ├─ Vault (AES-256)     │
       │                   │ └─ Telemetry             │
       │                   └──────────────────────────┘
       │                            │
       │                   ┌────────┴────────┐
       │                   │ MySQL    Redis   │
       │                   │ (data)   (cache) │
       │                   └─────────────────┘
       │
       ▼
LLM Providers
(OpenAI, Anthropic, etc.)
```

---

## 2. THE SCANNING ENGINE

### What It Does

Analyzes API collections (Postman, OpenAPI, Bruno) for security issues.

### How It Works

**Step 1: Parse**

```
Collection JSON → Extract endpoints, headers, body, auth
```

**Step 2: Detect**

```
For each endpoint:
  - Check for secrets in headers/body
  - Verify auth presence on mutating methods
  - Detect injection patterns in query params
  - Flag debug headers in production
  - Check for integer IDs (IDOR risk)
  - Validate HTTPS usage
```

**Step 3: Enrich**

```
Raw finding → Enriched finding:
  + Confidence score (0-100)
  + What happened
  + Why it matters
  + How dangerous
  + How to fix
  + Evidence snippets
  + Reference URLs (CWE, OWASP)
```

**Step 4: Deduplicate**

```
Same endpoint + same CWE = one finding
Merge evidence, take highest confidence
```

**Step 5: Prioritize**

```
Sort by: Severity → Confidence → Fix ease
```

---

## 3. AGENTGUARD (The Kill Switch)

### What It Does

Monitors LLM API calls in real-time and stops anomalous behavior.

### How It Works

**Step 1: Intercept**

```
Every outbound LLM API call passes through AgentGuard proxy
```

**Step 2: Analyze Patterns**

```
Track per API key:
  - Call rate (calls/minute)
  - Token burn rate (tokens/minute)
  - Cost trajectory ($/hour)
  - Recursion depth (A calls B calls A)
```

**Step 3: Detect Anomalies**

```
Trigger if:
  - > 20 calls in 60 seconds (infinite loop)
  - Cost > 3× baseline (cost spike)
  - Recursion depth > 5 (runaway agent)
  - Duplicate prompts > 80% (retry storm)
```

**Step 4: Kill Switch**

```
On trigger:
  1. Block the next API call
  2. Return error to calling code
  3. Alert developer via VS Code notification
  4. Log security event
  5. Update dashboard
```

### Latency

```
Detection: < 10ms
Kill switch activation: < 50ms
Total overhead per call: < 5ms
```

---

## 4. HIDDEN COST DETECTION

### The Problem

OpenAI's API response includes:

```json
{
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

But hidden reasoning tokens (for o1 models) are NOT included in `completion_tokens`.

### How We Detect

```
Step 1: Intercept API call
Step 2: Record visible tokens from response
Step 3: Estimate hidden reasoning tokens:
  hidden = total_latency × model_speed - visible_tokens
Step 4: Calculate real cost:
  real_cost = (visible_tokens + hidden_tokens) × price_per_token
Step 5: Alert if real_cost > 3 × visible_cost
```

### Patent

This method is patent pending (NHCE/DEV/2026/001).

---

## 5. SECURITY ARCHITECTURE

### Defense in Depth

| Layer              | Protection                                          |
| ------------------ | --------------------------------------------------- |
| **Network**        | TLS 1.3, CORS strict, rate limiting                 |
| **Application**    | JWT auth, CSRF tokens, input validation             |
| **Data**           | AES-256-GCM at rest, parameterized queries          |
| **Infrastructure** | Connection pooling, circuit breakers, health checks |
| **Monitoring**     | Security event logging, anomaly detection           |

### Secret Handling

```
API keys stored in:
  - VS Code: SecretStorage (OS keychain)
  - Server: Vault with AES-256-GCM
  - Never in logs, never in error messages
```

---

## 6. SCALING ARCHITECTURE

### Current (Single Node)

- ~500 concurrent users
- ~100 req/s webhooks
- ~50 concurrent scans

### Scaling Path

```
1,000 users   → Read replica + CDN
5,000 users   → Separate scan worker pool
10,000 users  → Redis Cluster + DB sharding
50,000 users  → Microservices (gateway, scanner, realtime)
```

---

## 7. TECHNOLOGY CHOICES

### Why TypeScript + Node.js?

- Team expertise
- Fast iteration
- Rich ecosystem (tRPC, Drizzle, Zod)
- Same language across stack

### Why tRPC over REST?

- End-to-end type safety
- No API drift
- Built-in batching
- Automatic validation

### Why MySQL over Postgres?

- Existing team expertise
- JSON support for flexible collection storage
- Easier managed hosting (Render)

### Why Redis?

- Rate limiting (sliding window)
- Session cache
- Pub/sub for real-time
- Job queues (BullMQ)

---

## 8. DEPLOYMENT

### CI/CD Pipeline

```
Push to main
    ↓
GitHub Actions:
  1. Lint + Type Check
  2. Unit Tests (596 tests)
  3. Security Audit (dependency + secrets + SAST)
  4. E2E Tests (Playwright)
  5. Docker Build + Push to GHCR
    ↓
Render deploy (API)
Vercel deploy (Frontend)
VS Code Marketplace publish (Extension)
```

### Environments

| Env        | Purpose            | Data        |
| ---------- | ------------------ | ----------- |
| Local      | Development        | Mock/seeded |
| Staging    | QA + chaos testing | Synthetic   |
| Production | Live users         | Real        |

---

_Architecture documentation maintained by engineering team._
_Updated when significant changes occur._
