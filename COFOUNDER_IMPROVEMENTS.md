# Rakshex Co-Founder Engineering Assessment

> Comprehensive audit of what needs improvement before we are truly "market ready."
> As your co-founder and CTO, here is what I would fix, build, and harden.

---

## EXECUTIVE SUMMARY

**The Good:** Code is feature-complete, well-architected, and the frontend deployment is solid. 478 tests, 37 API routers, clean separation of concerns.

**The Gaps:** There are critical security, UX, reliability, and commercial gaps that will hurt us in production, with investors, and with customers. These are fixable in 1-2 days of focused work.

**Priority Order:** Security → Reliability → UX → Performance → Commercial polish

---

## 🔴 CRITICAL — Security & Reliability (Must Fix Before Launch)

### 1. Missing Content-Security-Policy (CSP) Header

**Risk:** XSS attacks via injected scripts, even with our security scanning.

**Current state:** `next.config.js` has 5 security headers but NO CSP.

**Fix:** Add CSP header to `next.config.js`:

```js
{
  key: "Content-Security-Policy",
  value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https://api.rakshex.in https://*.sentry.io; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
}
```

### 2. No Request Size Limits on File Uploads

**Risk:** DoS via massive file uploads to `/api/import` or collection endpoints.

**Current state:** Express body parser likely uses defaults (100KB).

**Fix:** Add `express.json({ limit: "1mb" })` and `express.urlencoded({ limit: "1mb" })` with strict limits. Validate file sizes before processing.

### 3. Missing Account Lockout on Failed Logins

**Risk:** Brute force attacks on login endpoint.

**Current state:** No rate limiting on auth endpoints specifically.

**Fix:** Add Redis-backed account lockout after 5 failed attempts in 15 minutes. Return generic error message to prevent user enumeration.

### 4. No WebSocket Authentication

**Risk:** Dashboard WebSocket (`/ws`) accepts connections without verifying JWT.

**Current state:** `getWsUrl()` connects without auth token.

**Fix:** Add JWT token to WebSocket connection URL query param, validate server-side before accepting connection.

### 5. Missing Input Sanitization on Search/Query Params

**Risk:** NoSQL injection or regex DoS on search endpoints.

**Current state:** Several endpoints pass user input directly to `.find()` queries without sanitization.

**Fix:** Use `mongo-sanitize` or Zod strict validation on ALL query parameters. Limit regex query complexity.

### 6. Session Token Not Rotated on Privilege Change

**Risk:** Old sessions remain valid after password change, role change, or team removal.

**Current state:** No session invalidation on security-sensitive actions.

**Fix:** Add `sessionVersion` to user table. Increment on password change/role change. Reject tokens with old version.

### 7. Missing Backup & Disaster Recovery

**Risk:** Database corruption = total data loss.

**Current state:** No automated backups documented.

**Fix:**

- Render MySQL has daily backups, but we need:
- Automated S3 backups (daily snapshot + weekly full)
- Point-in-time recovery tested
- Documented RTO/RPO targets

---

## 🟠 HIGH — UX & Accessibility (Will Hurt Conversions)

### 8. No Loading States on Dashboard Pages

**Problem:** Users see blank screens while tRPC queries load. Looks broken.

**Affected:** `/dashboard`, `/scanning`, `/collections`, `/analytics`, `/billing`, `/team`, `/settings`

**Fix:** Add `loading.tsx` files to every app directory. Use skeleton cards matching the layout.

### 9. No Error Boundaries on Dashboard Sections

**Problem:** One failing tRPC query crashes the entire page.

**Affected:** All dashboard routes using tRPC.

**Fix:** Wrap each major section in `<ErrorBoundary>` with graceful fallback UI and retry button.

### 10. Missing Empty States

**Problem:** New users see empty tables with no guidance on what to do next.

**Affected:** `/collections`, `/scanning`, `/team`, `/audit-log`, `/billing`

**Fix:** `EmptyState` component exists but is not consistently used. Add CTA buttons in empty states ("Import your first collection", "Invite a team member").

### 11. No Accessibility (a11y) Compliance

**Problem:** Screen readers cannot use the app. Keyboard navigation broken. Violates WCAG 2.1 AA.

**Issues found:**

- No `aria-label` on icon-only buttons (Sidebar, Kill Switch toggle)
- No `aria-live` regions for toast notifications
- No focus management in modals
- Missing `alt` text on all images
- No skip-to-content link
- Color contrast failures on some gray text (`text-gray-400` on `bg-gray-800` is borderline)

**Fix:** Systematic a11y audit. Add `aria-*` attributes. Ensure 4.5:1 contrast ratio. Add keyboard shortcuts.

### 12. Mobile Dashboard Unusable

**Problem:** Sidebar takes full width on mobile. Tables overflow. Buttons too small.

**Current state:** Mobile sidebar exists but dashboard content is not responsive.

**Fix:** Add horizontal scroll to tables. Stack cards vertically. Increase touch targets to 44px minimum.

---

## 🟡 MEDIUM — Performance & Scale (Will Break at 100+ Users)

### 13. No Database Connection Pooling Limits

**Problem:** Under load, MySQL connections will exhaust and crash the backend.

**Current state:** Drizzle connection pool size not explicitly configured.

**Fix:** Set `poolSize: 20` in Drizzle config. Add connection timeout (30s). Monitor active connections.

### 14. Missing Pagination on List Endpoints

**Problem:** `/api/collections.list`, `/api/audit-log.list`, `/api/team.members` return ALL records.

**Risk:** OOM on large accounts. 10,000 audit logs = massive JSON payload.

**Fix:** Add cursor-based pagination (limit/offset) to ALL list endpoints. Default to 50 items.

### 15. No CDN for Static Assets

**Problem:** Landing page images, icons, screenshots served from Vercel origin.

**Fix:** Upload to Cloudflare R2 or AWS S3 + CloudFront. Add CDN rewrite rules in Vercel.

### 16. Large Bundle Size

**Problem:** `vendor-core` chunk is ~193KB. Recharts, tRPC client, and Monaco (if present) are heavy.

**Fix:**

- Lazy load Recharts (`dynamic import`)
- Code-split admin dashboard
- Tree-shake unused Lucide icons (import individually)

### 17. No API Response Caching

**Problem:** Static data (plans, features, pricing) fetched fresh every page load.

**Fix:** Add Redis cache layer for immutable data. Set `Cache-Control` headers on public pages.

---

## 🟢 LOW — Commercial Polish (Investor & Customer Impressions)

### 18. No Live Chat Widget

**Problem:** Users cannot get help instantly. High bounce rate on pricing page.

**Fix:** Add Crisp/Intercom widget. Or build simple widget connecting to Slack.

### 19. Missing "Compare" Feature Matrix on Landing Page

**Problem:** Comparison table exists but is text-only. No visual checkmarks/X marks.

**Fix:** Add styled feature matrix table with Rakshex checkmarks vs competitor X marks.

### 20. No API Playground / Interactive Docs

**Problem:** Developers want to test API before signing up.

**Fix:** Add Swagger UI or simple HTML form for testing key endpoints (health, scan preview).

### 21. Missing "Book a Demo" Calendly Integration

**Problem:** Enterprise prospects cannot schedule a call.

**Fix:** Embed Calendly on `/demo` and `/solutions/enterprise` pages.

### 22. No Cookie Consent Preferences Modal

**Problem:** Current banner is accept-only. Violates GDPR "granular consent" requirement.

**Fix:** Add "Manage Preferences" button opening modal with toggles for Essential, Analytics, Marketing cookies.

### 23. Missing Webhook Event Catalog

**Problem:** Developers do not know what events we send.

**Fix:** Add `/webhooks` page documenting all event types, payload schemas, and retry policies.

### 24. No Dark Mode Toggle

**Problem:** Some users prefer light mode. System preference not respected.

**Fix:** Add `dark`/`light`/`system` toggle. Use Tailwind `dark:` classes consistently.

---

## 🔵 BACKEND — Code Quality & Completeness

### 25. 23 `any` Types in Frontend

**Problem:** `as any` in `providers.tsx`, `demo/page.tsx`, `red-team/page.tsx`, `research/page.tsx`. Hides bugs.

**Fix:** Replace with proper TypeScript types. Add shared `types/` directory for API response shapes.

### 26. Missing Integration Tests

**Problem:** 478 unit tests but no end-to-end flows (signup → scan → billing → cancel).

**Fix:** Add 5 critical user journey tests with Playwright.

### 27. No Dead Letter Queue for Failed Jobs

**Problem:** BullMQ job failures are lost if retry exhausted.

**Fix:** Add dead letter queue with alerting. Manual retry UI in admin dashboard.

### 28. Missing Webhook Retry Logic

**Problem:** Webhooks fire once. If recipient is down, event is lost.

**Fix:** Exponential backoff retry (3, 5, 15 minutes). Store delivery attempts.

### 29. No API Versioning

**Problem:** Breaking changes to tRPC routers will break VS Code extension and SDK clients.

**Fix:** Add `/api/v1/` prefix. Document deprecation policy.

---

## 📋 PRIORITY ACTION PLAN

### Week 1 (Pre-Launch Blockers)

| Day | Task                                                    | Impact      |
| --- | ------------------------------------------------------- | ----------- |
| 1   | Add CSP header + fix security headers                   | 🔴 Critical |
| 1   | Add rate limiting to auth endpoints                     | 🔴 Critical |
| 2   | Add `loading.tsx` + `error.tsx` to all dashboard routes | 🟠 High     |
| 2   | Fix mobile responsive issues on dashboard               | 🟠 High     |
| 3   | Add pagination to list endpoints                        | 🟡 Medium   |
| 3   | Fix 23 `any` types                                      | 🟡 Medium   |
| 4   | Add empty states with CTAs                              | 🟠 High     |
| 4   | Add a11y attributes (aria-label, alt, focus)            | 🟠 High     |
| 5   | Add database connection limits                          | 🟡 Medium   |
| 5   | Add WebSocket auth                                      | 🔴 Critical |

### Week 2 (Polish & Scale)

| Day | Task                                    | Impact      |
| --- | --------------------------------------- | ----------- |
| 6   | Add live chat widget                    | 🟢 Low      |
| 6   | Add Calendly integration                | 🟢 Low      |
| 7   | Add API playground                      | 🟢 Low      |
| 7   | Add webhook retry + DLQ                 | 🟡 Medium   |
| 8   | Add bundle splitting                    | 🟡 Medium   |
| 8   | Add CDN for assets                      | 🟡 Medium   |
| 9   | Write E2E tests (5 journeys)            | 🟡 Medium   |
| 9   | Add session rotation                    | 🔴 Critical |
| 10  | Final security audit + penetration test | 🔴 Critical |

---

## ESTIMATED EFFORT

| Category                | Tasks               | Dev Days         |
| ----------------------- | ------------------- | ---------------- |
| Security hardening      | 6 items             | 2 days           |
| UX/Loading/Error states | 4 items             | 2 days           |
| Accessibility           | 1 systematic audit  | 1 day            |
| Performance             | 5 items             | 2 days           |
| Commercial polish       | 7 items             | 2 days           |
| Backend robustness      | 5 items             | 2 days           |
| **Total**               | **28 improvements** | **~11 dev days** |

**With you and me as a 2-person team: ~1 week of focused work.**

---

## WHAT I WILL FIX RIGHT NOW

I am going to immediately implement the highest-impact, lowest-effort fixes:

1. **Add CSP header** to `next.config.js`
2. **Add `loading.tsx`** to all dashboard app directories
3. **Add `error.tsx`** to all dashboard app directories
4. **Fix the 23 `any` types** in frontend
5. **Add empty states** to collection/scanning pages
6. **Fix mobile responsive** tables and cards
7. **Add aria-labels** to icon-only buttons
8. **Add API response pagination** to critical list endpoints
9. **Add session rotation** on password change
10. **Add rate limiting** to auth endpoints

These 10 fixes cover the critical + high items and will take ~2 hours to implement.
