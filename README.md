<p align="center">
  <img src="https://img.shields.io/badge/DevPulse-v4.0.0-7c3aed?style=for-the-badge&labelColor=1e1e2e" alt="Version" />
  <img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.111+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Tests-145_Passing-10b981?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="License" />
</p>

<h1 align="center">DevPulse</h1>
<h3 align="center">API Security & Cost Intelligence for the AI Agent Era</h3>

<p align="center">
  DevPulse is a full-stack platform that helps developers <strong>secure AI API integrations</strong>, <strong>control costs</strong>, and <strong>monitor reliability</strong> — all from a single dashboard.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-frontend-pages">Pages</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## 🧠 Why DevPulse?

AI-powered applications are exploding. Every one of them depends on third-party APIs — OpenAI, Anthropic, Stripe, Twilio, and dozens more. But:

- **API keys leak** into codebases, logs, and CI pipelines
- **Costs spiral** when prompt injection or retry storms hit production
- **Breaking changes** from providers silently break your product
- **No single tool** covers security scanning + cost tracking + reliability monitoring

**DevPulse solves all four.** One platform. One dashboard. One VS Code extension.

---

## ⚡ Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12+ |
| Node.js | 20+ |
| Git | 2.x |

### 1. Clone & Install

```bash
git clone https://github.com/Akshu1245/DevPulse.git
cd DevPulse
```

**Backend:**
```bash
cd devpulse-backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd devpulse-dashboard-ui
npm install
```

### 2. Configure Environment

```bash
cp devpulse-backend/.env.example devpulse-backend/.env
```

Edit `.env` with your keys (only `GROQ_API_KEY` is required for AI features — everything else has sensible defaults):

```env
GROQ_API_KEY=your_groq_api_key_here

# Optional - falls back to SQLite if not set
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/devpulse

# Optional - falls back to in-memory LRU cache
REDIS_URL=redis://localhost:6379/0
```

### 3. Run Locally

**Start the backend** (port 8000):
```bash
cd devpulse-backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Start the frontend** (port 3000):
```bash
cd devpulse-dashboard-ui
npm run dev
```

Open **http://localhost:3000** — the dashboard is live.

### 4. Docker (Alternative)

```bash
docker-compose up --build
```

This starts PostgreSQL, Redis, the backend, and the frontend in one command.

---

## 🚀 Features

### 🔒 Pillar 1 — AI Security

| Feature | Description |
|---------|-------------|
| **Token Leak Scanner** | Detects hardcoded API keys (GitHub, Stripe, AWS, OpenAI, 20+ providers) in your code |
| **Agent Attack Detection** | Finds prompt injection, tool poisoning, and privilege escalation vulnerabilities |
| **OWASP LLM Top 10** | Scans for all 10 categories from the OWASP LLM Security framework |
| **AI Fix Suggestions** | Groq-powered AI generates one-click fix patches for every finding |
| **Threat Intelligence Feed** | Real-time feed of API security threats, breaches, and CVEs |
| **Security Score Card** | Overall security grade (A–F) with category breakdown |

### 💰 Pillar 2 — Cost Intelligence

| Feature | Description |
|---------|-------------|
| **Cost Dashboard** | Real-time view of API spend across all providers |
| **Budget Forecasting** | 30-day ML-based prediction with anomaly detection |
| **Budget Manager** | Set spending limits with automated kill-switches |
| **ROI Calculator** | Calculate team savings from DevPulse adoption |
| **Optimization Report** | AI-generated recommendations to cut API costs by up to 40% |
| **Billing Panel** | Manage plans, view invoices, upgrade/downgrade |

### 📡 Pillar 3 — Reliability & Monitoring

| Feature | Description |
|---------|-------------|
| **Health Monitor** | Real-time uptime/latency tracking for 15+ API providers |
| **Change Detection** | Alerts when API response schemas change unexpectedly |
| **Incident Timeline** | Full incident history with event-level detail |
| **Alert Manager** | Configurable alerts via email, Slack, or webhook |
| **CI/CD Quality Gates** | Block deploys that fail security or cost thresholds |

### 🛠 Developer Tools

| Feature | Description |
|---------|-------------|
| **Code Generator** | Generate secure API integration code (Python, Java, Go, Rust) |
| **API Compatibility Checker** | Check if two APIs can integrate and get the integration path |
| **Mock Server** | Create mock API endpoints for testing |
| **Docs Search** | AI-powered search across API documentation |
| **OpenAPI Import** | Import and analyze OpenAPI/Swagger specs |
| **Marketplace** | Browse and install community API templates |

---

## 🏗 Architecture

```
DevPulse/
├── devpulse-backend/              # FastAPI backend (Python)
│   ├── main.py                    # App entry — 111 routes, 4 middleware layers
│   ├── routes/                    # 23 route modules
│   │   ├── ai_security.py        #   Token leak + agent attack scanning
│   │   ├── cost_intelligence.py   #   Cost dashboard + forecasting
│   │   ├── auth.py               #   JWT authentication + registration
│   │   ├── billing.py            #   Stripe integration
│   │   ├── security.py           #   OWASP scanning + security reports
│   │   ├── alerts.py             #   Alert configuration & history
│   │   ├── budget.py             #   Budget management & kill-switches
│   │   ├── cicd.py               #   CI/CD pipeline quality gates
│   │   ├── incidents.py          #   Incident tracking & timeline
│   │   ├── marketplace_routes.py  #   Template marketplace
│   │   ├── teams.py              #   Team management & RBAC
│   │   └── ...                   #   12 more route modules
│   ├── models/
│   │   ├── tables.py             # 24 SQLAlchemy ORM models
│   │   └── schemas.py            # Pydantic request/response schemas
│   ├── services/                  # Business logic layer
│   │   ├── ai_security_engine.py  #   Core scanning engine
│   │   ├── cost_engine.py        #   Cost calculation & forecasting
│   │   └── ...                   #   Additional services
│   ├── middleware/                # Security headers, rate limiting, sanitization
│   ├── alembic/                   # Database migrations
│   └── tests/                    # 14 test files, 145 passing tests
│
├── devpulse-dashboard-ui/         # Next.js frontend (TypeScript)
│   ├── src/
│   │   ├── app/                  # 20 route pages (App Router)
│   │   ├── components/           # 31 feature components
│   │   │   ├── ui/               #   Design system (Card, Button, Badge)
│   │   │   └── layout/           #   Shell, Sidebar, Topbar
│   │   └── lib/                  # API client, utilities
│   └── public/                   # Static assets
│
├── vscode-extension/              # VS Code Extension
│   └── src/extension.ts          # 10 commands for in-editor scanning
│
└── docker-compose.yml             # PostgreSQL + Redis + Backend + Frontend
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI 0.111+, Python 3.12+, Pydantic v2 |
| **Database** | PostgreSQL 16 (prod) / SQLite (dev fallback) |
| **ORM** | SQLAlchemy 2.0 (async) + Alembic migrations |
| **Cache** | Redis 7 (prod) / In-memory LRU (dev fallback) |
| **Auth** | JWT (PyJWT) + bcrypt password hashing |
| **AI** | Groq API (Llama 3) for fix suggestions |
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 |
| **Extension** | VS Code Extension API, TypeScript |
| **Billing** | Stripe (subscriptions, webhooks) |
| **Monitoring** | Sentry (error tracking), PostHog (analytics) |
| **Infra** | Docker Compose, Uvicorn (ASGI) |

### Data Models (24 Tables)

| Category | Models |
|----------|--------|
| **Core** | `User`, `ApiKey`, `BudgetLog`, `CodeHistory`, `UsageStat` |
| **Security** | `SecurityScan`, `AiSecurityScan`, `ThreatEvent` |
| **Cost Intelligence** | `ApiCallLog`, `CostBudget`, `CostForecast` |
| **Monitoring** | `ApiResponse`, `ChangeAlert`, `Incident`, `IncidentEvent` |
| **Alerts** | `AlertConfig`, `AlertHistory`, `KillSwitch` |
| **Teams** | `Team`, `TeamMember` |
| **Marketplace** | `MarketplaceTemplate`, `MarketplaceReview` |
| **Operations** | `CicdRun`, `BillingEvent`, `CustomApi` |

### Middleware Pipeline

Every request passes through 4 middleware layers in order:

```
Request → CORS → Rate Limiter (60/min) → Security Headers → Input Sanitization → Route Handler
```

---

## 📡 API Reference

**Base URL:** `http://localhost:8000`

### Authentication

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "secure123"}'

# Login (returns JWT token)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@example.com", "password": "secure123"}'
```

Use the returned token in subsequent requests:
```
Authorization: Bearer <your_jwt_token>
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API info & version |
| `GET` | `/health` | Health check with dependency status |
| `GET` | `/api/dashboard` | Comprehensive dashboard data |

### Security Scanning

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/security/scan/full` | Full security scan (token leaks + agent attacks + OWASP) |
| `POST` | `/api/v1/security/scan/tokens` | Scan for hardcoded API keys/secrets |
| `POST` | `/api/v1/security/scan/agents` | Scan for AI agent attack vectors |
| `POST` | `/api/v1/security/scan/owasp-llm` | OWASP LLM Top 10 scan |
| `GET` | `/api/v1/security/threat-feed` | Latest threat intelligence |
| `POST` | `/api/v1/security/ai-fix` | AI-generated fix suggestions |

### Cost Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/costs/dashboard` | Cost overview & analytics |
| `GET` | `/api/v1/costs/forecast` | 30-day spending forecast |
| `POST` | `/api/v1/costs/roi` | ROI calculation |
| `GET` | `/api/v1/costs/budgets` | Budget list & status |
| `POST` | `/api/v1/costs/budgets` | Create spending budget |

### Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health-checks` | Multi-provider health status |
| `GET` | `/api/incidents` | Incident history |
| `GET` | `/api/changes` | API change detection alerts |
| `GET` | `/api/alerts` | Alert configurations |
| `POST` | `/api/cicd/gate` | CI/CD quality gate check |

### Developer Tools

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Generate secure API integration code |
| `POST` | `/api/compatibility/check` | Check API-to-API compatibility |
| `POST` | `/api/mock/create` | Create mock API endpoint |
| `POST` | `/api/docs/search` | Search API documentation |

### Billing & Plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/billing/plans` | Available plans & pricing |
| `POST` | `/api/billing/subscribe` | Subscribe to a plan |
| `POST` | `/api/billing/cancel` | Cancel subscription |

> 📖 **Full interactive docs:** Visit [`http://localhost:8000/docs`](http://localhost:8000/docs) (Swagger UI) or [`http://localhost:8000/redoc`](http://localhost:8000/redoc) (ReDoc)

---

## 🖥 Frontend Pages

The dashboard uses a sidebar-based layout organized into 5 sections:

### Security
| Page | Route | Components |
|------|-------|------------|
| Security Overview | `/security` | SecurityScoreCard, SecurityReport, AIFixSuggestion, ApiInventory |
| Security Scanner | `/security/scanner` | SecurityScanner |
| Threat Feed | `/security/threats` | ThreatFeed |

### Costs
| Page | Route | Components |
|------|-------|------------|
| Cost Dashboard | `/costs` | CostIntelligenceDashboard, ROICalculator, PricingTable |
| Budget Manager | `/costs/budget` | BudgetManager |
| Budget Forecast | `/costs/forecast` | BudgetForecast |

### Operations
| Page | Route | Components |
|------|-------|------------|
| Health Monitor | `/ops/health` | HealthMonitor |
| Incident Timeline | `/ops/incidents` | IncidentTimeline |
| Alert Manager | `/ops/alerts` | AlertManager |
| CI/CD Pipeline | `/ops/cicd` | CICDPanel |

### Developer Tools
| Page | Route | Components |
|------|-------|------------|
| Code Generator | `/tools/generate` | CodeGenerator, CodeHistory |
| API Docs Search | `/tools/docs` | DocsSearch |
| Mock Server | `/tools/mock` | MockServer |
| Compatibility | `/tools/compatibility` | CompatibilityChecker |

### Settings
| Page | Route | Components |
|------|-------|------------|
| Billing & Plans | `/settings/billing` | BillingPanel |
| Analytics | `/settings/analytics` | AnalyticsDashboard |
| Marketplace | `/settings/marketplace` | Marketplace |
| Reports & Export | `/settings/reports` | ReportsExport |

### Design System

The UI is built on a custom design system with reusable primitives:

| Component | Purpose |
|-----------|---------|
| `Card` / `CardHeader` / `CardSkeleton` | Content containers with consistent styling, loading states |
| `Button` / `IconButton` | 5 variants (primary, secondary, ghost, danger, outline), 3 sizes, loading state |
| `Badge` | 6 color variants with optional dot indicator |
| `MetricCard` | Stat display with label, value, trend indicator |
| `EmptyState` | Placeholder for empty data with icon, title, description |
| `ProgressBar` | Animated progress indicator with color variants |
| `SectionHeader` | Consistent section titles with optional action slot |

---

## 🔌 VS Code Extension

Install the DevPulse extension for in-editor security scanning and cost estimation.

### Commands

| Command | Description |
|---------|-------------|
| `DevPulse: Full Security Scan` | Scan current file for all vulnerability types |
| `DevPulse: Scan Token Leaks` | Find hardcoded secrets in your code |
| `DevPulse: Scan Agent Attacks` | Detect prompt injection & tool poisoning |
| `DevPulse: AI Fix Suggestions` | Get AI-powered remediation patches |
| `DevPulse: Estimate API Cost` | Calculate estimated cost for API calls |
| `DevPulse: Check API Health` | Check real-time provider status |
| `DevPulse: CI/CD Quality Gate` | Run pre-commit security checks |
| `DevPulse: Threat Feed` | View latest security threats |
| `DevPulse: Cost Dashboard` | Open cost intelligence panel |
| `DevPulse: Show Dashboard` | Open full security & cost dashboard |

### Extension Settings

```json
{
  "devpulse.apiUrl": "http://localhost:8000",
  "devpulse.token": "",
  "devpulse.inlineDiagnostics": true,
  "devpulse.scanOnSave": false
}
```

**Supported Languages:** Python, JavaScript, TypeScript, Go, Java, YAML

---

## 🧪 Testing

```bash
cd devpulse-backend

# Run all 145 tests
python -m pytest tests/ -v

# Run with coverage report
python -m pytest tests/ -v --cov=. --cov-report=term-missing

# Run specific test category
python -m pytest tests/test_ai_security.py -v        # Security scan tests
python -m pytest tests/test_cost_intelligence.py -v   # Cost engine tests
python -m pytest tests/test_auth.py -v                # Auth flow tests
python -m pytest tests/test_billing.py -v             # Billing tests
python -m pytest tests/test_rate_limiting.py -v       # Rate limiter tests
```

### Test Suite

| Test File | Tests | Coverage Area |
|-----------|-------|--------------|
| `test_ai_security.py` | Integration | Full security scan pipeline |
| `test_ai_security_unit.py` | Unit | Token leak & agent attack detectors |
| `test_cost_intelligence.py` | Integration | Cost dashboard & forecasting |
| `test_cost_intelligence_unit.py` | Unit | Cost calculations & budget logic |
| `test_auth.py` | Integration | Registration, login, JWT lifecycle |
| `test_billing.py` | Integration | Stripe subscription management |
| `test_dashboard.py` | Integration | Dashboard data aggregation |
| `test_features.py` | Integration | Feature flags & capabilities |
| `test_infrastructure.py` | Integration | Health checks & middleware stack |
| `test_caching.py` | Unit | Redis + LRU cache behavior |
| `test_rate_limiting.py` | Integration | SlowAPI rate limiter |
| `test_pro_gate.py` | Integration | Pro tier access control |
| `test_postgresql.py` | Integration | Async database operations |
| `test_onboarding.py` | Integration | User onboarding flow |

---

## 🚢 Deployment

### Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d --build

# Services:
#   PostgreSQL 16  → port 5432
#   Redis 7        → port 6379
#   Backend API    → port 8000
#   Frontend UI    → port 3000
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | For AI features | — | Groq API key for AI fix suggestions |
| `DATABASE_URL` | No | SQLite fallback | `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | No | In-memory LRU | `redis://host:6379/0` |
| `JWT_SECRET` | Prod | Auto-generated | Secret key for JWT signing |
| `JWT_EXPIRY_HOURS` | No | `24` | Token expiration in hours |
| `STRIPE_SECRET_KEY` | For billing | Stub mode | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | For billing | — | Stripe webhook signing secret |
| `SENDGRID_API_KEY` | For emails | — | SendGrid email delivery key |
| `POSTHOG_API_KEY` | No | Disabled | PostHog analytics project key |
| `SENTRY_DSN` | No | Disabled | Sentry error tracking DSN |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS allowed origin |
| `ENV` | No | `development` | `development` or `production` |
| `LOG_LEVEL` | No | `info` | Logging verbosity |

### Manual Deployment

**Backend:**
```bash
cd devpulse-backend
pip install -r requirements.txt
alembic upgrade head            # Run database migrations
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Frontend:**
```bash
cd devpulse-dashboard-ui
npm install
npm run build
npm start
```

---

## 📊 Project Stats

| Metric | Count |
|--------|-------|
| Backend Routes | 111 |
| ORM Models | 24 |
| Route Modules | 23 |
| Frontend Pages | 20 |
| UI Components | 34 |
| VS Code Commands | 10 |
| Test Files | 14 |
| Passing Tests | 145 |
| Backend Dependencies | 21 |
| Middleware Layers | 4 |
| Docker Services | 4 |

---

## 🗺 Roadmap

- [ ] Multi-tenant workspaces with team RBAC
- [ ] GitHub/GitLab integration for PR security scanning
- [ ] Webhook-based real-time alerts (Slack, Discord, PagerDuty)
- [ ] OpenTelemetry tracing for API call observability
- [ ] Plugin system for custom security rules
- [ ] Mobile companion app (React Native)
- [ ] Self-hosted marketplace for enterprise templates

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for developers who care about API security and cost control.
</p>
