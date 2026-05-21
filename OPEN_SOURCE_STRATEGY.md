# Rakshex Open Source Strategy

> Strategic open-sourcing for trust, growth, and community.
> Date: 2026-05-17

---

## 1. PHILOSOPHY

### Why Open Source?

1. **Trust:** Developers can audit our security logic
2. **Growth:** Community contributions accelerate development
3. **SEO:** GitHub presence drives organic discovery
4. **Hiring:** Open source attracts top engineering talent
5. **Standard:** Become the default for AI security scanning

### What We Keep Proprietary?

- **AgentGuard orchestration** — The competitive moat
- **Anomaly scoring algorithms** — Trade secret
- **Unified risk engine** — Core IP
- **Enterprise workflows** — Paid feature differentiation
- **Compliance automation** — Enterprise value

---

## 2. OPEN SOURCE ROADMAP

### Phase 1: Rules + SDKs (Now)

- [ ] `rakshex-scanner-rules` — MIT licensed security rules
- [ ] `rakshex-sdk` — TypeScript SDK for API integration
- [ ] `rakshex-vscode-utils` — VS Code extension helpers

### Phase 2: Engines (Q3 2026)

- [ ] `prompt-injection-detector` — Standalone detection engine
- [ ] `api-collection-parser` — Postman/OpenAPI/Bruno parser
- [ ] `token-cost-calculator` — LLM cost estimation library

### Phase 3: Test Labs (Q4 2026)

- [ ] `vulnerable-api-labs` — Intentionally flawed collections for testing
- [ ] `agent-chaos-engine` — Rogue agent simulations
- [ ] `shadow-api-playground` — Shadow API discovery benchmark

### Phase 4: Platform (Q1 2027)

- [ ] `rakshex-community` — Self-hosted scanner (limited features)
- [ ] `rakshex-cli` — Command-line scanner

---

## 3. REPOSITORY STRUCTURE

```
rakshex/
├── rakshex/                    ← Main repo (proprietary)
│   ├── server/
│   ├── rakshex-vscode/
│   └── rakshex-frontend/
│
├── rakshex-scanner-rules/      ← Open source (MIT)
│   ├── rules/
│   ├── tests/
│   └── README.md
│
├── rakshex-sdk/                ← Open source (MIT)
│   ├── src/
│   ├── examples/
│   └── README.md
│
├── rakshex-test-labs/          ← Open source (MIT)
│   ├── vulnerable-api/
│   ├── rogue-agent/
│   └── shadow-api/
│
└── rakshex-community/          ← Open source (AGPL)
    ├── scanner/
    ├── cli/
    └── README.md
```

---

## 4. CONTRIBUTOR EXPERIENCE

### For Rules Contributors

```bash
# 1. Fork rakshex-scanner-rules
git clone https://github.com/yourname/rakshex-scanner-rules.git

# 2. Add a rule
cat > rules/insecure-cors.yaml <<EOF
id: insecure-cors-wildcard
name: Insecure CORS Configuration
severity: Medium
description: >
  CORS wildcard allows any origin to access the API.
detection:
  pattern: 'Access-Control-Allow-Origin: *'
  exclude:
    - 'public-read-only-endpoint'
remediation: >
  Replace * with specific allowed origins.
EOF

# 3. Test
npm test

# 4. PR
gh pr create --title "Add insecure CORS rule"
```

### Recognition

- Contributors listed in README
- Top contributors get Pro free for life
- Quarterly "Contributor Spotlight" blog post
- Conference speaking opportunities

---

## 5. LICENSE STRATEGY

| Component         | License     | Why                                          |
| ----------------- | ----------- | -------------------------------------------- |
| Scanner rules     | MIT         | Maximum adoption, easy contribution          |
| SDK               | MIT         | Developer-friendly, no restrictions          |
| Test labs         | MIT         | Educational, benchmark use                   |
| Community scanner | AGPL        | Prevent competitors from closed-source forks |
| Core platform     | Proprietary | Revenue protection                           |

---

## 6. GROWTH METRICS

| Metric               | Q2 2026 | Q4 2026 | Q2 2027 |
| -------------------- | ------- | ------- | ------- |
| GitHub stars (total) | 500     | 2,000   | 10,000  |
| Contributors         | 5       | 25      | 100     |
| Forks                | 50      | 200     | 500     |
| Issues resolved      | 20      | 100     | 500     |
| Blog posts about us  | 5       | 25      | 100     |

---

## 7. COMMUNITY MANAGEMENT

### Communication Channels

- **GitHub Discussions:** Technical questions, feature requests
- **Discord:** Real-time chat, beta testing
- **Dev.to:** Engineering blog, tutorials
- **Twitter/X:** Announcements, tips

### Governance

- **Benevolent dictator:** Akshay (founder) has final say
- **Maintainers:** Top 5 contributors become maintainers
- **Decision process:** RFC for major changes, PR review for minor

---

_Open source strategy maintained by developer relations team._
_Reviewed quarterly._
