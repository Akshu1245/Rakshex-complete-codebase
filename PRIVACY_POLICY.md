# DevPulse Privacy Policy

> Last updated: May 17, 2026

---

## 1. WHAT WE COLLECT

### Required for Service

| Data                 | Why                    | Retention             |
| -------------------- | ---------------------- | --------------------- |
| Email                | Account, auth, billing | Account lifetime      |
| API collections      | Security scanning      | Until deleted by user |
| Scan results         | Show findings, history | 90 days               |
| Workspace membership | Team features          | Account lifetime      |

### Optional / Telemetry

| Data                  | Why                 | Retention           |
| --------------------- | ------------------- | ------------------- |
| Extension usage stats | Product improvement | 90 days, aggregated |
| Feature usage         | Prioritize roadmap  | 90 days, aggregated |
| Error reports         | Fix bugs            | 30 days             |

### What We NEVER Collect

- ❌ Your source code (except API collection files you explicitly import)
- ❌ Your LLM prompts or responses
- ❌ Your API keys (we scan for them, but never store the values)
- ❌ PII from your API collections
- ❌ Browser history, cookies, or personal browsing data

---

## 2. HOW WE USE DATA

- **To provide the service:** Scan collections, show findings, send alerts
- **To improve the product:** Aggregated usage patterns (never individual)
- **To communicate:** Product updates, security alerts, billing
- **To comply with law:** If legally required by valid subpoena

We do NOT:

- Sell your data to third parties
- Use your data to train AI models without consent
- Share individual user data with partners

---

## 3. DATA STORAGE

- **Primary database:** MySQL on Render (US East)
- **Cache:** Redis (ephemeral, < 24 hours)
- **Backups:** Encrypted at rest, 30-day retention
- **Telemetry:** Anonymized, 90-day retention

All data is encrypted:

- **In transit:** TLS 1.3
- **At rest:** AES-256-GCM

---

## 4. YOUR RIGHTS (GDPR / CCPA)

| Right                | How to exercise                        |
| -------------------- | -------------------------------------- |
| Access your data     | Email security@devpulse.in             |
| Delete your data     | Settings → Delete Account (instant)    |
| Export your data     | Settings → Export Data (JSON)          |
| Opt out of telemetry | Settings → Privacy → Disable Telemetry |
| Correct your data    | Edit in Settings                       |
| Object to processing | Email security@devpulse.in             |

**Data deletion:** When you delete your account, all collections, scans, and personal data are permanently removed within 24 hours. Backups are purged within 30 days.

---

## 5. COOKIES

| Cookie               | Purpose                | Duration |
| -------------------- | ---------------------- | -------- |
| session              | Authentication         | 7 days   |
| csrf                 | CSRF protection        | Session  |
| \_devpulse_telemetry | Telemetry opt-out flag | 1 year   |

No third-party tracking cookies.

---

## 6. THIRD PARTIES

| Service     | Purpose        | Data Shared                             |
| ----------- | -------------- | --------------------------------------- |
| Stripe      | Payments       | Email, plan, payment method (tokenized) |
| Render      | Hosting        | None (we manage)                        |
| Redis Cloud | Caching        | None (encrypted)                        |
| Sentry      | Error tracking | Error messages (anonymized)             |

All third parties are SOC2 compliant.

---

## 7. SECURITY

- AES-256-GCM encryption for vault secrets
- bcrypt (cost 12) for passwords
- JWT with 7-day expiry
- Rate limiting on all endpoints
- Annual penetration testing
- Bug bounty program

See [SECURITY.md](SECURITY.md) for full details.

---

## 8. CONTACT

**Data Protection Officer:** Akshay, DevPulse Technologies
**Email:** privacy@devpulse.in
**Address:** DevPulse Technologies Pvt. Ltd., Bangalore, India

---

## 9. CHANGES

We will notify users of material changes via email and in-app banner.
Continued use after changes constitutes acceptance.

---

_This policy is a living document. Last reviewed: 2026-05-17._
