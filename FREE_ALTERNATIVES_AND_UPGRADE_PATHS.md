# Rakshex Free Alternatives & Upgrade Paths

> Vendor comparison for infrastructure decisions.
> Date: 2026-05-17

---

## LEGEND

| Symbol | Meaning                  |
| ------ | ------------------------ |
| ✅     | Currently using          |
| 🔄     | Migration path available |
| 💰     | Cost increase            |
| 🔒     | Lock-in risk             |

---

## 1. DATABASE

|                 | **Free**         | **Startup**   | **Scale**  | **Enterprise** |
| --------------- | ---------------- | ------------- | ---------- | -------------- |
| **Option**      | Supabase (500MB) | Neon (10GB)   | AWS RDS    | CockroachDB    |
| **Price**       | $0               | $0            | $100/mo    | $500/mo        |
| **Migration**   | Easy             | Easy          | Medium     | Hard           |
| **Lock-in**     | Low              | Low           | Medium     | Medium         |
| **Scalability** | 1K users         | 10K users     | 100K users | 1M users       |
| **Best for**    | MVP              | Early product | Growth     | Multi-region   |
| **Our pick**    |                  | ✅ **Neon**   | 🔄 AWS RDS |                |

---

## 2. AUTHENTICATION

|               | **Free**      | **Startup**     | **Scale**    | **Enterprise** |
| ------------- | ------------- | --------------- | ------------ | -------------- |
| **Option**    | Supabase Auth | Clerk           | Auth0        | Okta           |
| **Price**     | $0            | $25/mo          | $23/mo       | $2/user/mo     |
| **Migration** | Medium        | Easy            | Medium       | Hard           |
| **Lock-in**   | Medium        | Medium          | High         | High           |
| **Best for**  | Prototyping   | Developer tools | Enterprise   | Fortune 500    |
| **Our pick**  |               |                 | ✅ **Auth0** | 🔄 Okta        |

---

## 3. LLM PROVIDER

|               | **Free**           | **Startup**       | **Scale**           | **Enterprise** |
| ------------- | ------------------ | ----------------- | ------------------- | -------------- |
| **Option**    | OpenAI ($5 credit) | Together AI       | Azure OpenAI        | Self-hosted    |
| **Price**     | $0                 | $0.60/1M tokens   | $2/1M tokens        | Hardware cost  |
| **Migration** | N/A                | Easy              | Medium              | Hard           |
| **Lock-in**   | High               | Low               | High                | None           |
| **Best for**  | Testing            | Cost optimization | Compliance          | Privacy        |
| **Our pick**  |                    |                   | ✅ **Azure OpenAI** | 🔄 Self-hosted |

---

## 4. RATE LIMITING

|               | **Free**          | **Startup**        | **Scale**       | **Enterprise**    |
| ------------- | ----------------- | ------------------ | --------------- | ----------------- |
| **Option**    | Upstash (10K/day) | Redis Cloud        | AWS ElastiCache | Self-hosted Redis |
| **Price**     | $0                | $15/mo             | $100/mo         | $200/mo           |
| **Migration** | Easy              | Easy               | Medium          | Hard              |
| **Lock-in**   | Low               | Low                | Medium          | None              |
| **Our pick**  |                   | ✅ **Redis Cloud** | 🔄 ElastiCache  |                   |

---

## 5. MONITORING

|               | **Free**           | **Startup**                | **Scale**  | **Enterprise** |
| ------------- | ------------------ | -------------------------- | ---------- | -------------- |
| **Option**    | Sentry (5K errors) | Datadog                    | New Relic  | Dynatrace      |
| **Price**     | $0                 | $15/host/mo                | $49/mo     | Custom         |
| **Migration** | Easy               | Medium                     | Medium     | Hard           |
| **Lock-in**   | Low                | High                       | High       | High           |
| **Our pick**  |                    | ✅ **Sentry + Prometheus** | 🔄 Datadog |                |

---

## 6. QUEUE SYSTEM

|               | **Free**       | **Startup** | **Scale** | **Enterprise** |
| ------------- | -------------- | ----------- | --------- | -------------- |
| **Option**    | BullMQ (Redis) | AWS SQS     | RabbitMQ  | Kafka          |
| **Price**     | $0             | $0.40/mo    | $50/mo    | $500/mo        |
| **Migration** | N/A            | Easy        | Medium    | Hard           |
| **Lock-in**   | None           | Medium      | Low       | Low            |
| **Our pick**  | ✅ **BullMQ**  |             | 🔄 SQS    |                |

---

## 7. HOSTING

|               | **Free**               | **Startup** | **Scale**  | **Enterprise** |
| ------------- | ---------------------- | ----------- | ---------- | -------------- |
| **Option**    | Render/Vercel          | Railway     | AWS ECS    | Kubernetes     |
| **Price**     | $0                     | $5/mo       | $200/mo    | $1,000/mo      |
| **Migration** | Easy                   | Easy        | Medium     | Hard           |
| **Lock-in**   | Low                    | Low         | Medium     | Low            |
| **Our pick**  | ✅ **Render + Vercel** |             | 🔄 AWS ECS | 🔄 K8s         |

---

## 8. CDN

|               | **Free**               | **Startup**    | **Scale** | **Enterprise** |
| ------------- | ---------------------- | -------------- | --------- | -------------- |
| **Option**    | Cloudflare (free)      | Cloudflare Pro | Fastly    | Akamai         |
| **Price**     | $0                     | $20/mo         | $50/mo    | Custom         |
| **Migration** | N/A                    | Easy           | Medium    | Hard           |
| **Lock-in**   | Low                    | Low            | Medium    | High           |
| **Our pick**  | ✅ **Cloudflare Free** | 🔄 Pro         |           |                |

---

## 9. EMAIL

|               | **Free**   | **Startup**     | **Scale** | **Enterprise** |
| ------------- | ---------- | --------------- | --------- | -------------- |
| **Option**    | Gmail SMTP | SendGrid        | AWS SES   | Postmark       |
| **Price**     | $0         | $0              | $0.10/1K  | $1.25/1K       |
| **Migration** | Easy       | Easy            | Easy      | Easy           |
| **Lock-in**   | Low        | Medium          | Medium    | Low            |
| **Our pick**  |            | ✅ **SendGrid** | 🔄 SES    |                |

---

## 10. VECTOR DATABASE

|               | **Free**           | **Startup** | **Scale**     | **Enterprise** |
| ------------- | ------------------ | ----------- | ------------- | -------------- |
| **Option**    | Pinecone (starter) | Weaviate    | Qdrant        | Milvus         |
| **Price**     | $0                 | $25/mo      | $50/mo        | $200/mo        |
| **Migration** | N/A                | Medium      | Medium        | Hard           |
| **Lock-in**   | High               | Low         | Low           | Low            |
| **Our pick**  |                    |             | 🔄 **Qdrant** |                |

---

## MIGRATION COMPLEXITY MATRIX

| From → To           | Difficulty | Time    | Risk   |
| ------------------- | ---------- | ------- | ------ |
| Render → AWS ECS    | Medium     | 2 weeks | Low    |
| MySQL → Postgres    | Hard       | 4 weeks | Medium |
| Redis → ElastiCache | Easy       | 2 days  | Low    |
| Sentry → Datadog    | Medium     | 1 week  | Low    |
| BullMQ → SQS        | Medium     | 2 weeks | Medium |
| Vercel → Cloudflare | Easy       | 3 days  | Low    |

---

## LOCK-IN MITIGATION STRATEGY

1. **Abstract vendor SDKs** — Never use vendor-specific APIs directly
2. **Standard formats** — Export data in open formats (JSON, YAML, CSV)
3. **Multi-cloud ready** — Architecture supports any cloud provider
4. **Regular backups** — Automated exports to S3-compatible storage
5. **Contract terms** — Month-to-month where possible, avoid annual lock-in

---

_Document prepared for infrastructure planning and investor discussions._
