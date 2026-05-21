# Rakshex API Reference

Base URL: `https://api.rakshex.in` (self-hosted: your own domain)

All endpoints require authentication via:

- **Bearer token** in `Authorization: Bearer <token>` header (dashboard sessions)
- **API key** in `X-API-Key: <key>` header (SDK, VS Code, CI/CD)

## Authentication

### POST /api/auth/login

Log in with email and password.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "secure-password-123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "Jane Doe",
    "plan": "pro",
    "role": "admin"
  }
}
```

### POST /api/auth/refresh

Refresh an expired access token using the refresh token (cookie-based).

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Collections

### GET /api/trpc/collections.list

List collections for the authenticated user.

**Query Parameters:**

- `input` (JSON): `{ "page": 1, "pageSize": 20 }`

**Response:**

```json
{
  "result": {
    "data": {
      "collections": [
        {
          "id": "col_abc123",
          "name": "Production API",
          "format": "postman",
          "totalRequests": 42,
          "createdAt": "2026-05-01T12:00:00Z"
        }
      ],
      "total": 1,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
}
```

### POST /api/trpc/collections.create

Import a new collection.

**Request:**

```json
{
  "name": "Payment Gateway API",
  "format": "openapi",
  "data": {
    /* parsed spec */
  },
  "description": "Stripe integration endpoints"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "id": "col_def456",
      "name": "Payment Gateway API",
      "credentialFindings": [
        {
          "ruleId": "aws-secret-key",
          "severity": "critical",
          "path": "headers.x-api-key",
          "matchPreview": "AKIA..."
        }
      ],
      "gatewayFindings": []
    }
  }
}
```

### POST /api/trpc/collections.delete

Delete a collection and all associated scans.

**Request:**

```json
{ "id": "col_abc123" }
```

---

## Scanning

### POST /api/trpc/scanning.startScan

Enqueue a new security scan.

**Request:**

```json
{
  "collectionId": "col_abc123",
  "scanType": "full" // "full" | "quick" | "shadow_api" | "prompt_injection"
}
```

**Response:**

```json
{
  "result": {
    "data": {
      "scanId": "job_12345",
      "status": "queued",
      "message": "Scan has been queued and will begin shortly."
    }
  }
}
```

### GET /api/trpc/scanning.getScanStatus

Poll for scan completion.

**Query Parameters:**

- `input` (JSON): `{ "scanId": "job_12345" }`

**Response:**

```json
{
  "result": {
    "data": {
      "status": "completed",
      "progress": 100,
      "findings": 12,
      "riskLevel": "HIGH"
    }
  }
}
```

---

## Findings

### GET /api/trpc/shadowAPI.listShadowAPIs

List shadow APIs for a collection.

**Query Parameters:**

- `input` (JSON): `{ "collectionId": "col_abc123", "page": 1, "pageSize": 50 }`

**Response:**

```json
{
  "result": {
    "data": {
      "shadowAPIs": [
        {
          "id": "sha_789",
          "endpoint": "/internal/v2/users",
          "method": "POST",
          "riskLevel": "HIGH",
          "isDocumented": false
        }
      ],
      "total": 3,
      "page": 1
    }
  }
}
```

---

## Policies

### GET /api/trpc/policies.listRules

List policy rules for the current workspace.

**Query Parameters:**

- `input` (JSON): `{}`

**Response:**

```json
{
  "result": {
    "data": {
      "rules": [
        {
          "ruleId": "rule_001",
          "name": "Block GPT-4 on sensitive endpoints",
          "priority": 0,
          "enabled": true,
          "action": "block",
          "conditions": {
            "operator": "AND",
            "rules": [{ "field": "model", "op": "eq", "value": "gpt-4o" }]
          }
        }
      ]
    }
  }
}
```

### POST /api/trpc/policies.createRule

Create a new policy rule.

**Request:**

```json
{
  "name": "Require approval for high-cost models",
  "priority": 1,
  "conditions": {
    "operator": "AND",
    "rules": [{ "field": "costUsd", "op": "gt", "value": 0.5 }]
  },
  "action": "require_approval"
}
```

---

## Telemetry & Cost

### GET /api/trpc/tokenAnalytics.getUsage

Get token usage and cost breakdown.

**Query Parameters:**

- `input` (JSON): `{ "days": 30 }`

**Response:**

```json
{
  "result": {
    "data": {
      "totalCostUSD": 1247.5,
      "totalTokens": 45600000,
      "byModel": [
        { "model": "gpt-4o", "costUSD": 890.0, "tokens": 30000000 },
        { "model": "claude-3-5-sonnet", "costUSD": 357.5, "tokens": 15600000 }
      ],
      "byDay": [{ "date": "2026-05-16", "costUSD": 45.2, "tokens": 1800000 }]
    }
  }
}
```

---

## Kill Switch

### POST /api/trpc/killSwitch.setBudget

Set a monthly LLM budget limit.

**Request:**

```json
{ "budgetLimitUSD": 5000 }
```

### POST /api/trpc/killSwitch.trigger

Manually trigger the kill switch.

**Request:**

```json
{ "reason": "Emergency: suspected data exfiltration" }
```

### POST /api/trpc/killSwitch.reset

Reset the kill switch after resolution.

**Request:**

```json
{ "reason": "Incident resolved, traffic restored" }
```

---

## Webhooks

### POST /api/webhooks (Express route)

Receive GitHub App webhook events.

**Headers:**

- `X-GitHub-Event: pull_request`
- `X-Hub-Signature-256: sha256=...`

**Payload:** Standard GitHub webhook payload.

### POST /api/import/preview

Preview competitor data before importing.

**Request:**

```json
{
  "source": "helicone",
  "data": {
    /* raw Helicone export */
  }
}
```

**Response:**

```json
{
  "collections": 3,
  "endpoints": 47,
  "estimatedTokens": 12000000
}
```

---

## Rate Limits

| Endpoint Category     | Limit         | Window   |
| --------------------- | ------------- | -------- |
| Auth (login, refresh) | 10 requests   | 1 minute |
| Scanning (start)      | 5 requests    | 1 minute |
| General API           | 100 requests  | 1 minute |
| Webhook ingestion     | 1000 requests | 1 minute |

Rate limit headers included in all responses:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Error Codes

| HTTP | Code                    | Meaning                        |
| ---- | ----------------------- | ------------------------------ |
| 400  | `BAD_REQUEST`           | Invalid input                  |
| 401  | `UNAUTHORIZED`          | Missing or invalid credentials |
| 403  | `FORBIDDEN`             | Insufficient permissions       |
| 404  | `NOT_FOUND`             | Resource does not exist        |
| 409  | `CONFLICT`              | Resource already exists        |
| 429  | `TOO_MANY_REQUESTS`     | Rate limit exceeded            |
| 500  | `INTERNAL_SERVER_ERROR` | Unexpected server error        |

## SDKs

- **JavaScript/TypeScript:** `npm install @rakshex/sdk`
- **Python:** `pip install rakshex`
- **Go:** `go get github.com/rakshex/rakshex-go`

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API version history.
