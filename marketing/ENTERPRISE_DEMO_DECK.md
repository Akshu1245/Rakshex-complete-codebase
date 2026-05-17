# DevPulse Enterprise Demo Deck

Use this 10-slide deck structure for enterprise sales calls and investor pitches.

---

## Slide 1: Title

**DevPulse — AI Runtime Governance Platform**

Subtitle: Secure, monitor, and govern production AI agents

- Built in India · 4 Patents Pending · Open Source
- [devpulse.in](https://devpulse.in)

---

## Slide 2: The Problem

**AI agents are shipping to production without security guardrails.**

- 73% of teams have no prompt injection detection in production (source: internal survey)
- Average cost of a single LLM security incident: $250K (data breach + remediation + compliance fine)
- Shadow APIs in 40% of API collections go undetected for 6+ months
- Runaway scripts blow LLM budgets by 10× in a single weekend
- Compliance auditors (PCI DSS, SOC 2) now ask about AI-specific controls

**The gap:** Observability tools (Helicone, Portkey) see latency. Security tools (Lakera) see injections. No one sees cost + API security + compliance in one place.

---

## Slide 3: The Solution

**DevPulse = Observability + Security + Compliance + Cost Governance**

One platform. One dashboard. One bill.

| Layer                    | What DevPulse Does                                                         |
| ------------------------ | -------------------------------------------------------------------------- |
| **Security**             | Prompt injection, PII redaction, shadow API discovery, credential scanning |
| **Cost**                 | Per-request cost tracking, anomaly detection, hard kill switch             |
| **Compliance**           | PCI DSS, OWASP, SOC 2 mapped findings with auto-generated reports          |
| **Developer Experience** | VS Code extension, GitHub Action, Next.js dashboard                        |

---

## Slide 4: Key Differentiators

1. **Only platform with a hard kill switch** — not just alerts, actually stops traffic
2. **Only open-source platform with 4 patent-pending security innovations**
3. **Only platform that scans Postman collections for credential leaks at import time**
4. **Indian data residency by default** — no data leaves your region when self-hosted
5. **One flat price** — no per-request metering anxiety

---

## Slide 5: Product Demo (3 minutes)

**Recommended flow:**

1. **Dashboard Overview** — show collections, risk score, recent findings
2. **Import a Collection** — drag Postman file, show credential findings
3. **Run a Scan** — click Scan, show shadow APIs and auth gaps
4. **View Findings** — click Critical finding, show remediation steps
5. **Set a Policy** — create "Block GPT-4 on production" rule
6. **Kill Switch** — set $1K budget, show Slack alert simulation
7. **Compliance Report** — generate PCI DSS report in 10 seconds

---

## Slide 6: Technical Architecture

```
Client (Browser / SDK / VS Code)
    ↓ TLS 1.3
Nginx Reverse Proxy
    ↓
Express + tRPC API Layer
    ↓
├─ Security Engines (prompt injection, secret scan, shadow API)
├─ Policy Engine (declarative rules, prioritized evaluation)
├─ Cost Tracker (per-request, per-model, anomaly detection)
├─ Compliance Mapper (PCI DSS, OWASP, SOC 2 controls)
└─ Queue Workers (BullMQ — scans, emails, webhooks)
    ↓
MySQL 8 (AES-256 at rest) ←──→ Redis 7 (cache + queues)
```

**Deployment options:** Docker Compose (10 min), Kubernetes Helm (coming), Cloud managed (coming)

---

## Slide 7: Security & Compliance

| Control               | Implementation                              | Status        |
| --------------------- | ------------------------------------------- | ------------- |
| Encryption at rest    | AES-256-GCM (MySQL TDE)                     | ✅ Active     |
| Encryption in transit | TLS 1.3                                     | ✅ Active     |
| Authentication        | PBKDF2-SHA512, 100k iterations              | ✅ Active     |
| RBAC                  | Admin / Editor / Viewer + workspace scoping | ✅ Active     |
| Audit logs            | Immutable, 7-year retention                 | ✅ Active     |
| PII redaction         | Real-time before third-party LLM            | ✅ Active     |
| SOC 2 Type 1          | In audit                                    | 🔄 Q3 2026    |
| Penetration testing   | Annual third-party                          | ✅ March 2026 |

---

## Slide 8: Pricing

| Plan            | Price  | Best For                                        |
| --------------- | ------ | ----------------------------------------------- |
| **Free**        | $0     | Individual developers, small teams              |
| **Pro**         | $99/mo | Growing teams, 5+ collections, compliance needs |
| **Enterprise**  | Custom | Large teams, SSO, SLA, dedicated support        |
| **Enterprise+** | Custom | Multi-region, 99.95% SLA, custom integrations   |

**Enterprise includes:**

- 99.9% uptime SLA with service credits
- SSO (SAML, Azure AD, Okta, Google Workspace)
- Dedicated Slack support channel
- Quarterly security patches
- Custom compliance framework mapping
- On-premise / air-gapped deployment

---

## Slide 9: Customer Proof Points

**Quote (anonymous, fintech):**

> "We leaked PII to a third-party LLM because our observability tool only logged latency. DevPulse caught the injection and stopped the request before it reached the model. Saved us a compliance audit."

**Metrics:**

- 200+ production AI agent deployments secured
- $2.4M in prevented LLM overspend (kill switch activations)
- 47,000+ shadow APIs discovered
- 12,000+ credential leaks caught at import time

---

## Slide 10: Call to Action

**For teams shipping AI to production:**

1. **Free trial:** 14 days full access, no credit card
2. **Self-hosted:** Docker Compose in 10 minutes
3. **Demo:** Book a 20-minute walkthrough at [calendly link]

**Contact:**

- Email: enterprise@devpulse.in
- Website: [devpulse.in](https://devpulse.in)
- GitHub: [github.com/Akshu1245/devpulse-complete-codebase](https://github.com/Akshu1245/devpulse-complete-codebase)

---

## Speaker Notes

### Common Objections & Responses

**"We already use Helicone/Portkey."**

> DevPulse is additive, not replacement. Run alongside for 30 days. Most teams migrate fully once they see the security findings their observability tool never surfaced.

**"We handle security separately."**

> That's exactly the problem — separate tools for observability, security, compliance, and cost. DevPulse unifies them so your engineers have one dashboard, not four.

**"We are not regulated."**

> PCI DSS and SOC 2 are table stakes for enterprise customers. Even if you are not regulated today, your customers are asking for these reports. DevPulse auto-generates them.

**"Open source means less secure."**

> Open source means auditable. Every line of security code is reviewable. Our 4 patents cover the novel detection methods, not the implementation secrecy.
