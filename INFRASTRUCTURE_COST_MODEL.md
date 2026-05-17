# DevPulse Infrastructure Cost Model

> Unit economics for investor conversations.
> Date: 2026-05-17

---

## 1. COST STRUCTURE

### Variable Costs (per user/month)

| Component          | Free Tier | Pro ($29/mo) | Enterprise ($99/mo) |
| ------------------ | --------- | ------------ | ------------------- |
| **API Compute**    | $0.50     | $1.50        | $5.00               |
| **Database**       | $0.30     | $1.00        | $3.00               |
| **Redis**          | $0.10     | $0.30        | $1.00               |
| **Storage**        | $0.05     | $0.20        | $0.80               |
| **LLM API calls**  | $0.20     | $0.80        | $3.00               |
| **Bandwidth**      | $0.05     | $0.20        | $0.80               |
| **Total variable** | **$1.20** | **$4.00**    | **$13.60**          |
| **Revenue**        | $0        | $29          | $99                 |
| **Gross margin**   | N/A       | **86%**      | **86%**             |

### Fixed Costs (monthly)

| Component         | Now     | 1K users | 10K users  | 50K users   |
| ----------------- | ------- | -------- | ---------- | ----------- |
| Render (API)      | $25     | $75      | $300       | $1,200      |
| Vercel (Frontend) | $20     | $20      | $100       | $400        |
| Redis Cloud       | $15     | $30      | $80        | $250        |
| MySQL (Render)    | $15     | $25      | $100       | $400        |
| Sentry            | $0      | $26      | $79        | $289        |
| SendGrid          | $0      | $20      | $90        | $400        |
| Stripe fees       | $0      | $290     | $2,900     | $14,500     |
| **Total fixed**   | **$75** | **$486** | **$4,649** | **$17,439** |

---

## 2. UNIT ECONOMICS

### Gross Margin Analysis

```
Revenue per user:      $29 (Pro average)
Variable cost:         $4.00
Gross profit:          $25.00
Gross margin:          86%
```

**Benchmark:**

- Datadog: ~75% gross margin
- Snyk: ~80% gross margin
- GitHub: ~85% gross margin
- **DevPulse: ~86% gross margin** ✅

### Payback Period

| Metric                           | Value    |
| -------------------------------- | -------- |
| CAC (paid ads + content)         | $150     |
| LTV (24-month, 5% monthly churn) | $580     |
| LTV/CAC                          | 3.9x     |
| Payback period                   | 6 months |

**Benchmark:**

- SaaS average: 3.0x LTV/CAC
- Developer tools: 4.0x LTV/CAC
- **DevPulse: 3.9x LTV/CAC** ✅

---

## 3. SCALING COSTS

### Infrastructure Scaling

```
1,000   users → $486/mo  ($0.49/user)
5,000   users → $1,949/mo ($0.39/user)
10,000  users → $4,649/mo ($0.46/user)
50,000  users → $17,439/mo ($0.35/user)
100,000 users → $32,000/mo ($0.32/user)
```

**Economies of scale:** Cost per user decreases as fixed costs are amortized.

### Break-Even Analysis

| Users | Revenue  | Costs   | Profit   |
| ----- | -------- | ------- | -------- |
| 100   | $2,900   | $486    | $2,414   |
| 500   | $14,500  | $1,949  | $12,551  |
| 1,000 | $29,000  | $4,649  | $24,351  |
| 5,000 | $145,000 | $17,439 | $127,561 |

**Break-even:** ~20 users (assuming $29/mo average)

---

## 4. COST OPTIMIZATION OPPORTUNITIES

### Short Term (Now)

1. **MySQL read replica** for analytics queries → 30% DB cost reduction
2. **Redis caching** for user profiles → 20% DB cost reduction
3. **CDN for static assets** → 50% bandwidth cost reduction

### Medium Term (6 months)

1. **S3 for collection data** → 70% storage cost reduction
2. **Spot instances for scan workers** → 60% compute cost reduction
3. **Connection pooling** → 15% DB cost reduction

### Long Term (12 months)

1. **Multi-tenancy** → shared infrastructure → 40% cost reduction
2. **Edge functions** → offload compute → 25% API cost reduction
3. **Custom ML inference** → reduce OpenAI dependency → 50% LLM cost reduction

---

## 5. INVESTOR QUESTIONS

### Q: "What's your gross margin?"

**A:** 86% on Pro tier, 86% on Enterprise. Comparable to GitHub and Snyk. We achieve this through efficient architecture (Drizzle over Prisma, Redis caching, connection pooling) and by charging for value (security + cost intel) not compute.

### Q: "How do costs scale?"

**A:** Sub-linearly. Fixed costs dominate at small scale, variable costs are only $4/user at Pro tier. At 50K users, we're at $0.32/user infrastructure cost with $29 ARPU.

### Q: "What's your biggest cost risk?"

**A:** LLM API costs for compliance report generation and AI features. We're mitigating this with: (1) caching of common queries, (2) tiered LLM usage (GPT-4 for complex, GPT-3.5 for simple), (3) bringing ML inference in-house at scale.

### Q: "When do you reach profitability?"

**A:** At ~500 paying users assuming $29 ARPU and $150 CAC. With organic growth (developer virality), we expect CAC to drop to $50, making break-even at ~200 users.

---

_Model prepared for investor due diligence._
_Assumptions: 60% Pro, 30% Enterprise, 10% Free tier mix at scale._
