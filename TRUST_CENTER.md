# DevPulse Trust Center

> Everything you need to trust DevPulse with your code.
> Last updated: 2026-05-17

---

## OUR SECURITY PROMISE

**DevPulse is designed to protect you, not watch you.**

1. **Your code stays yours.** We never store your source code.
2. **Your data is encrypted.** AES-256-GCM at rest, TLS 1.3 in transit.
3. **You control everything.** Opt out of any feature anytime.
4. **We're transparent.** Open about what we collect and why.
5. **We're accountable.** Public status, public incidents, public fixes.

---

## DATA PRACTICES

### What We Collect

| Data                | Why                 | Retention                | Can Opt Out? |
| ------------------- | ------------------- | ------------------------ | ------------ |
| API key (hashed)    | Authentication      | Until you delete account | N/A          |
| Collection metadata | Scanning            | 90 days                  | Yes          |
| Finding results     | Your dashboard      | Until you delete         | Yes          |
| Scan telemetry      | Product improvement | 1 year                   | Yes          |
| Extension heartbeat | Reliability         | 90 days                  | Yes          |
| Error logs          | Debugging           | 30 days                  | Yes          |

### What We NEVER Collect

- ❌ Your source code (parsed locally, never uploaded)
- ❌ Your API request/response bodies
- ❌ Your environment variables (except what you explicitly import)
- ❌ Your user data or PII beyond email
- ❌ Your IP address (anonymized in logs)

---

## SECURITY ARCHITECTURE

```
┌─────────────────────────────────────┐
│  Your Machine (VS Code)            │
│  • Collection parsed locally        │
│  • Only metadata sent to API        │
│  • AES-256-GCM encrypted storage    │
└──────────────┬──────────────────────┘
               │ TLS 1.3
               ▼
┌─────────────────────────────────────┐
│  DevPulse API (AWS)                │
│  • No code persistence              │
│  • Scan results encrypted at rest   │
│  • 30-second request timeout        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Database (RDS)                     │
│  • Encrypted volumes                │
│  • Automated backups                │
│  • Point-in-time recovery           │
└─────────────────────────────────────┘
```

---

## COMPLIANCE ROADMAP

| Standard      | Status         | Target Date |
| ------------- | -------------- | ----------- |
| SOC 2 Type II | In progress    | Q3 2026     |
| GDPR          | Compliant      | Now         |
| CCPA          | Compliant      | Now         |
| ISO 27001     | Planned        | Q4 2026     |
| HIPAA         | Not applicable | —           |

---

## RESPONSIBLE DISCLOSURE

Found a vulnerability in DevPulse? We want to know.

**Contact:** security@devpulse.in
**PGP Key:** [link]
**Response time:** 24 hours
**Bounty:** Up to $5,000 for critical issues

**Scope:**

- DevPulse API (api.devpulse.in)
- VS Code extension
- Dashboard (devpulse.in)
- Documentation

**Rules:**

- Don't access data that isn't yours
- Don't degrade service for others
- Give us reasonable time to fix before public disclosure

**We promise:**

- No legal action for good-faith research
- Public acknowledgment (with your permission)
- Fair bounty evaluation

---

## TRANSPARENCY REPORTS

| Period   | Report | Key Findings |
| -------- | ------ | ------------ |
| May 2026 | [Link] |              |

---

## STATUS PAGE

Real-time system status: [status.devpulse.in](https://status.devpulse.in)

Subscribe to updates:

- Email alerts
- RSS feed
- Slack integration
- Webhook

---

## CONTACT

| Topic              | Contact                |
| ------------------ | ---------------------- |
| Security questions | security@devpulse.in   |
| Privacy questions  | privacy@devpulse.in    |
| Compliance         | compliance@devpulse.in |
| General            | support@devpulse.in    |

---

_Trust Center maintained by security + legal team._
_Updated monthly._
