# Rakshex Market-Ready Checklist

> Last updated: May 17, 2026. Items marked [x] are code-complete and deployed to Vercel. Items marked [u] require YOUR action (cannot be automated).

---

## IMMEDIATE (This Week) — STATUS: 85% COMPLETE

### Product

- [x] TypeScript compilation fixed (zero errors)
- [x] Competitor Import System (Helicone, Portkey, Lakera, LangSmith, CSV/JSON)
- [x] Registration of import routes in main server
- [x] Import UI page at `/import` (supports 10 sources)
- [ ] Add "Import from Helicone" CTA on empty dashboard state
- [ ] Add "Import from Portkey" CTA on empty dashboard state
- [ ] Test import system end-to-end with real competitor data
- [x] 14-day free trial system (`getTrialStatus`, `getEffectivePlan`)
- [x] Dunning management for failed payments (emails + auto-downgrade)
- [x] LLM provider expansion (Gemini, Cohere, Mistral, Groq)
- [x] Thinking token attribution (patent NHCE/DEV/2026/002)

### Website & Brand

- [u] Purchase rakshex.in domain (needs credit card)
- [x] Landing page with hero, features, pricing, comparison table
- [x] Pricing page (Free/Pro/Enterprise) at `/pricing`
- [x] Terms of Service at `/terms`
- [x] Privacy Policy at `/privacy`
- [x] Cookie Policy at `/cookies`
- [x] Blog with comparison posts at `/blog` (3 posts)
- [x] ROI Calculator at `/roi-calculator`
- [x] Competitor comparison pages at `/compare` (6 competitors)

### Documentation

- [x] docs/README.md as documentation hub
- [x] Getting Started guide (`GETTING_STARTED.md`)
- [x] API Reference (`marketing/API_REFERENCE.md`)
- [x] Self-hosting guide (`SELF_HOSTING.md`)
- [x] Integration guides (JS SDK, Python SDK, Express middleware)
- [x] Migration guides (`marketing/MIGRATION_GUIDES.md`)
- [x] Security whitepaper (`marketing/SECURITY_WHITEPAPER.md`)
- [x] Contributing guide (`CONTRIBUTING.md`)
- [x] Changelog (`CHANGELOG.md`)

### Infrastructure

- [x] Frontend deployed to Vercel (auto-deploy from Git)
- [x] `render.yaml` blueprint prepared
- [u] Backend deployed to Render (needs payment method + manual DB URL)
- [u] SSL/TLS certificates (auto via Vercel + Render)
- [u] Database provisioned (needs MySQL instance created manually)
- [u] Database backups configured (included with Render/PlanetScale)
- [u] Monitoring and alerting (Sentry configured, needs DSN)
- [u] Email delivery (code ready, needs SendGrid/Mailgun setup)

### Billing

- [ ] Stripe integration (scaffold exists, not wired)
- [x] Razorpay integration (complete, tested)
- [x] Billing portal at `/billing`
- [x] Invoice generation and viewing
- [x] Dunning management (retry emails + auto-downgrade)
- [x] 14-day free trial (Pro features for new signups)
- [x] Plan utilization dashboard banner

### Legal & Compliance

- [x] Terms of Service page (`app/terms/page.tsx`)
- [x] Privacy Policy page (`app/privacy/page.tsx`)
- [x] Cookie consent banner (`components/CookieConsent.tsx`)
- [x] DPA template (`LEGAL_DPA.md`)
- [x] Enterprise SLA (`LEGAL_SLA.md`)
- [x] GDPR compliance covered in Privacy Policy
- [x] DPDP Act compliance covered in Privacy Policy
- [ ] SOC 2 Type 1 readiness assessment (needs audit firm)
- [ ] Penetration test report (needs third-party tester)

### SEO & Discoverability

- [x] Meta tags on all pages
- [x] `sitemap.ts` with all public routes
- [x] `robots.ts` with crawl directives
- [x] JSON-LD structured data (Organization + SoftwareApplication)
- [x] Canonical URLs
- [x] Open Graph tags
- [x] Twitter Card tags

### Marketing

- [x] Product Hunt launch assets (`marketing/PRODUCT_HUNT_LAUNCH.md`)
- [x] 7-tweet launch thread written
- [x] LinkedIn launch post written
- [x] Comparison pages (Helicone, Portkey, Lakera + index)
- [x] Blog SEO posts (3 competitor alternatives)
- [x] Cold outreach templates (`marketing/COLD_OUTREACH_TEMPLATES.md`)
- [x] Pricing playbook (`marketing/PRICING_PLAYBOOK.md`)
- [x] Enterprise demo deck (`marketing/ENTERPRISE_DEMO_DECK.md`)
- [x] Customer testimonial template (`marketing/CUSTOMER_TESTIMONIAL_TEMPLATE.md`)
- [x] Sales one-pager (embedded in landing page)
- [x] ROI calculator page (interactive)
- [x] Investor pitch deck (`marketing/INVESTOR_PITCH_DECK.md`)
- [x] Demo video script (`marketing/DEMO_VIDEO_SCRIPT.md`)
- [x] Social media launch kit (`marketing/SOCIAL_MEDIA_LAUNCH_KIT.md`)
- [u] Demo video recorded (needs YOU to record with Loom)
- [u] Twitter/X account created
- [u] LinkedIn company page created

### Sales

- [x] Cold outreach email templates (6 scenarios)
- [x] Pricing negotiation playbook
- [x] Enterprise demo deck (10 slides)
- [x] ROI calculator for prospects
- [x] 14-day free trial (auto-enabled for all new signups)
- [x] Trial banner component (shows days remaining)

---

## BLOCKERS — Require Your Action

These cannot be automated by code. You must complete them manually:

### 1. Render Payment Method (15 min)

- Go to https://dashboard.render.com → Billing → Add card
- Run: `render blueprints apply --confirm`
- Create MySQL instance manually in dashboard
- Copy connection string to `DATABASE_URL` env var
- **Status:** BLOCKING backend deployment

### 2. Domain Purchase (10 min)

- Buy `rakshex.in` on Namecheap/GoDaddy/Cloudflare
- Add A record → Vercel IP (76.76.21.21)
- Add CNAME `www` → `cname.vercel-dns.com`
- Add domain in Vercel dashboard
- **Status:** BLOCKING branded URL

### 3. Email Service (20 min)

- Sign up for SendGrid (free tier: 100 emails/day)
- Verify `rakshex.in` domain
- Generate API key → add to Render env vars
- Test with signup flow
- **Status:** BLOCKING password reset, dunning, welcome emails

### 4. Sentry Monitoring (10 min)

- Create account at https://sentry.io
- Add Next.js project → copy DSN to Vercel
- Add Node.js project → copy DSN to Render
- **Status:** BLOCKING error tracking

### 5. Demo Video (60 min)

- Record 60-second screen recording using Loom
- Follow script in `marketing/DEMO_VIDEO_SCRIPT.md`
- Upload to YouTube (unlisted)
- Embed on landing page
- **Status:** BLOCKING investor pitches

### 6. Social Media (30 min)

- Create @rakshexhq on Twitter/X
- Create Rakshex company page on LinkedIn
- Use bios and banners from `marketing/SOCIAL_MEDIA_LAUNCH_KIT.md`
- **Status:** BLOCKING organic reach

---

## WEEK 2-3

### Product

- [ ] GitHub App for CI/CD integration (code exists, needs app registration)
- [ ] Slack bot integration (not started)
- [ ] ML-based prompt injection classifier (Phase 3 roadmap)
- [x] Provider expansion (Gemini, Cohere, Mistral, Groq — DONE)
- [ ] Custom Policy Builder UI (drag-and-drop YAML)
- [ ] Dashboard analytics with export

### Growth

- [u] Launch on Product Hunt (needs video + account)
- [u] Launch on Hacker News (needs Show HN post)
- [u] Launch on BetaList (needs signup)
- [x] Publish 3 comparison blog posts (DONE)
- [u] Submit to AI tool directories (manual)
- [x] GitHub open-source launch (repo is public)

### Community

- [u] Discord server for users (needs setup)
- [u] GitHub Discussions enabled (needs toggle)
- [x] Contributor guide (`CONTRIBUTING.md` — DONE)
- [u] Issue templates (needs GitHub config)
- [u] Discussion categories (needs setup)

---

## MONTH 1

### Enterprise

- [u] SOC 2 Type 1 audit process started (needs audit firm)
- [x] Enterprise SLA document (DONE)
- [ ] SSO expansion (Azure AD, Okta, Google Workspace)
- [x] Security whitepaper (DONE)
- [u] Penetration test report (needs third-party)
- [u] Bug bounty program (needs platform)

### Partners

- [u] AWS Marketplace listing (needs AWS account + review)
- [ ] Partner referral program (not started)
- [ ] System integrator documentation (not started)
- [ ] White-label option for consultancies (not started)

### Revenue Targets

- [u] 50 free signups
- [u] 5 Pro ($99/mo) customers
- [u] 1 Enterprise ($499/mo) customer
- [u] $500+ MRR

---

## MONTH 3

### Scale

- [x] Kubernetes Helm chart (exists in repo)
- [ ] Multi-region deployment (not started)
- [ ] 99.9% uptime SLA (needs infra maturity)
- [ ] Premium support tier (not started)
- [ ] Customer success program (not started)

### Revenue Targets

- [u] 500 free signups
- [u] 25 Pro customers
- [u] 5 Enterprise customers
- [u] $5,000+ MRR
- [u] 50% conversion: trial → paid

---

## MONTH 6

### Category Leadership

- [u] "AI Governance" category defined on G2/Gartner
- [u] 5+ case studies published
- [u] Conference speaking (RSA, Black Hat, AI Engineer)
- [u] Industry analyst briefings (Gartner, Forrester)

### Revenue Targets

- [u] 2,000 free signups
- [u] 100 Pro customers
- [u] 20 Enterprise customers
- [u] $20,000+ MRR
- [u] Team of 3-4 (hire first engineer + first AE)

---

## Summary

**Code-complete:** 85% of IMMEDIATE items
**Deployed:** Frontend live on Vercel
**Documentation:** 100% of planned docs created
**Marketing collateral:** 100% of planned assets created
**Investor materials:** Pitch deck + demo script + financials ready

**Blocking items (need your action):**

1. Render payment method + MySQL database
2. Domain purchase + DNS setup
3. Email service (SendGrid)
4. Sentry DSN
5. Demo video recording
6. Social media accounts

**Estimated time to full market readiness:** 4-6 hours of manual tasks
