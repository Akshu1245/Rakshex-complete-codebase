# DevPulse Changelog

## v4.0.0 — "The AI Agent Era" (2025-06-27)

### 🎯 Major Repositioning
DevPulse is now **The API Security & Cost Intelligence Platform Built for the AI Agent Era**. Three focused pillars replace the previous general-purpose monitoring approach.

---

### Pillar 1: AI API Security Scanner (NEW)
- **14 token/secret patterns**: OpenAI, Anthropic, Google AI, AWS, Azure, Stripe, GitHub, Groq, HuggingFace, Cohere, Mistral, and more
- **7 AI agent attack detectors**: Prompt injection, unrestricted tool use, agent SSRF, code execution, excessive permissions, memory poisoning, data exfiltration
- **OWASP API Security Top 10 (2023)**: Full coverage with pattern matching
- **AI-powered fix suggestions**: Groq LLM integration with static fallback
- **Threat intelligence feed**: Simulated live threat feed with severity ratings
- **API inventory scanner**: Auto-detect 13+ API providers in your codebase
- **Security score**: Composite score (0-100) with letter grades (A-F)
- **New service**: `services/ai_security_engine.py`
- **New route**: `routes/ai_security.py` — 8 endpoints under `/api/v1/security/*`

### Pillar 2: API Cost Intelligence (NEW)
- **20+ AI model pricing**: GPT-4o, GPT-4o-mini, GPT-4-turbo, Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku, Gemini 1.5 Pro/Flash, Llama 3.1, Mixtral, Command R+, and more
- **Cost calculation engine**: Per-call cost with input/output token breakdown
- **Cost breakdown**: By provider, model, and day
- **30-day forecasting**: Weighted moving average with confidence levels
- **Anomaly detection**: Standard deviation-based with configurable thresholds
- **Optimization recommendations**: Model switching, caching, token reduction, batching
- **ROI calculator**: Monthly/annual savings estimates with payback period
- **Budget management**: Per-provider budgets with alert thresholds
- **New service**: `services/cost_intelligence.py`
- **New route**: `routes/cost_intelligence.py` — 10 endpoints under `/api/v1/costs/*`

### Pillar 3: VS Code Extension (UPGRADED)
- **Inline diagnostics**: Real-time token leak warnings as you type (8 patterns)
- **8 commands** (up from 4): Full Security Scan, Scan Token Leaks, Scan Agent Attacks, Cost Estimate, AI Fix Suggestions, Show Dashboard, Check Health, CI/CD Gate
- **Status bar integration**: Shield icon with one-click scan
- **Scan on save**: Optional auto-scan when saving files
- **Cost estimation**: Quick pick for model selection + token count
- **AI Fix webview**: Dedicated panel showing AI-generated fix suggestions
- **Enhanced dashboard webview**: Security score + cost overview in split view
- **Configuration**: `devpulse.inlineDiagnostics`, `devpulse.scanOnSave`
- **Language activation**: Auto-activates for Python, JavaScript, TypeScript, Go, Java, YAML
- **Version**: 0.1.0 → 0.4.0

### Infrastructure
- **PostgreSQL**: Added async PostgreSQL support via asyncpg + SQLAlchemy 2.0
- **Redis**: Added Redis caching with in-memory LRU fallback
- **Alembic**: Async migration runner configured
- **New ORM models**: AiSecurityScan, ThreatEvent, ApiCallLog, CostBudget, CostForecast
- **Docker**: PostgreSQL + Redis containers added to docker-compose.yml

### Frontend (10 New Components)
- SecurityScoreCard — Score display with scan history and code input
- ThreatFeed — Live threat intelligence with expand/collapse
- CostIntelligenceDashboard — Cost breakdown by provider and model
- BudgetForecast — 30-day predictions with sparkline visualization
- AIFixSuggestion — AI-powered fix recommendations display
- ApiInventory — Auto-discover API providers in code
- SecurityReport — Optimization recommendations
- OnboardingChecklist — 5-step getting started checklist
- PricingTable — Free / Pro ($29) / Team ($99) pricing display
- ROICalculator — Interactive ROI calculator with sliders

### Landing Page
- Complete rewrite with new positioning
- "Stop API Breaches. Cut AI Costs by 40%." headline
- Three pillars section with feature breakdowns
- Stats bar: 14 token patterns, 7 agent detectors, 20+ models, < 2s scan
- How It Works: Paste → Scan → Fix
- Updated pricing: Free / Pro $29 / Team $99

### Tests
- **Backend**: 5 new test files, 45+ test cases covering AI security + cost intelligence
- **Frontend**: 3 new Jest tests for SecurityScoreCard, CostIntelligenceDashboard, ROICalculator
- **Cypress**: Updated landing and dashboard E2E tests for v4.0 content

### API Client
- 19 new methods added to `api.ts` for security and cost endpoints

---

## v3.0.0 (Previous)
- 93 registered routes
- 21 route files, 19 services
- 21 frontend components
- Stripe billing, SendGrid email, PostHog analytics
- Docker setup, CI/CD gates, Kill-switch

## v2.0.0 (Previous)
- Initial route wiring (21 routes)
- Health monitoring, budget management, code generation
- Security scanning, mock server, incident timeline

## v1.0.0 (Initial)
- Project scaffolding
- FastAPI + Next.js + SQLite foundation
