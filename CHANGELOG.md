# Changelog

All notable changes to Rakshex are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Competitor import system (Helicone, Portkey, Lakera, LangSmith, CSV/JSON)
- Competitor import CTAs on collections empty state
- VS Code extension packaging in CI workflow
- Cohere, Mistral, and Groq LLM provider adapters with cost tracking
- SEO metadata: canonical URLs, Twitter cards, metadataBase
- `robots.ts` and `sitemap.ts` for search engine indexing
- JSON-LD structured data (Organization, WebSite, SoftwareApplication)
- Audit log entries for approvals, kill switch, API keys, webhooks, team actions

### Fixed

- 37 TypeScript compilation errors across server and frontend
- Drizzle `execute()` signature mismatches (raw SQL+params → sql templates)
- `ctx.workspace` used on `protectedProcedure` contexts
- Snake_case vs camelCase property name mismatches in test files
- Missing/renamed imports across multiple files
- Duplicate router imports in `routers.ts`
- Cost tracking bug: `routeLLM` only tracks for MiniMax, avoiding double-counting

### Security

- Verified ownership checks on all critical tRPC routers

## [0.2.0] — 2026-04-15

### Added

- Refresh token rotation with dual-cookie strategy
- Distributed rate limiting with Redis backing
- BullMQ job queues for scans, webhooks, emails, telemetry
- OpenTelemetry tracing integration
- React Error Boundaries in frontend layout
- Landing page with feature highlights and pricing cards
- Onboarding wizard with 5-step progress tracking
- Demo page with interactive scan simulator
- Billing portal with success/failure pages
- Terms of Service and Privacy Policy pages
- Cookie consent banner
- GitHub App integration (webhooks, PR scanning)
- Policy engine with declarative rule engine
- Kill switch with budget controls and Slack alerts
- Team invitation system
- Webhook lifecycle management with HMAC signatures
- Data export (JSON, CSV, PDF)
- VS Code extension scaffold

### Infrastructure

- Docker Compose production setup
- GitHub Actions CI (lint, test, e2e, build, security scan, deploy)
- Nginx reverse proxy configuration

## [0.1.0] — 2026-03-01

### Added

- Initial release
- Postman and OpenAPI collection import
- API security scanning engine
- Shadow API detection
- Prompt injection detection
- LLM cost tracking
- Compliance reporting (PCI DSS, OWASP)
- Alert rules and notifications
- User authentication and workspace management
- Dashboard with collection and scan management
