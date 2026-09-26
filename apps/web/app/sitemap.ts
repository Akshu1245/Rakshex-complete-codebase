import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rakshex.in";

// Canonical, indexable, public 200-status URLs only.
// lastModified reflects the last real content change per route (sourced from
// git history on 2026-09-26) — NOT build time. Google ignores changefreq and
// priority, so they are omitted. When page content changes, bump that route's
// date here; do not stamp every URL on every deploy.
// Excluded on purpose: gated /incidents (307), auth pages (/login,
// /register), app surfaces, and /legal/ai-transparency (does not exist).
const routes: Array<[string, string]> = [
  ["", "2026-09-26"],
  ["/pricing", "2026-09-26"],
  ["/privacy", "2026-08-28"],
  ["/terms", "2026-09-06"],
  ["/cookies", "2026-08-28"],
  ["/legal", "2026-08-28"],
  ["/legal/dpa", "2026-08-28"],
  ["/legal/sla", "2026-08-28"],
  ["/legal/aup", "2026-08-28"],
  ["/legal/refund", "2026-08-28"],
  ["/legal/subprocessors", "2026-08-28"],
  ["/dpa", "2026-08-28"],
  ["/security", "2026-09-06"],
  ["/demo", "2026-09-26"],
  ["/compare", "2026-08-28"],
  ["/compare/helicone", "2026-08-28"],
  ["/compare/portkey", "2026-08-28"],
  ["/compare/lakera", "2026-08-28"],
  ["/compare/langsmith", "2026-08-28"],
  ["/compare/datadog", "2026-08-28"],
  ["/compare/snyk", "2026-08-28"],
  ["/features", "2026-09-26"],
  ["/about", "2026-08-28"],
  ["/faq", "2026-09-26"],
  ["/trust", "2026-08-28"],
  ["/changelog", "2026-08-28"],
  ["/integrations", "2026-09-26"],
  ["/partners", "2026-08-28"],
  ["/open-source", "2026-09-26"],
  ["/status", "2026-08-28"],
  ["/overview", "2026-09-26"],
  ["/waitlist", "2026-08-28"],
  ["/agent-firewall", "2026-09-26"],
  ["/api-docs", "2026-09-26"],
  ["/docs", "2026-08-28"],
  ["/docs/agent-firewall", "2026-08-28"],
  ["/docs/getting-started", "2026-08-28"],
  ["/blog", "2026-09-02"],
  ["/blog/ai-agent-api-security-blind-spot", "2026-08-28"],
  ["/blog/claude-code-approval-fatigue-action-policy-2026", "2026-09-02"],
  ["/blog/cloudflare-ai-spend-limits-2026", "2026-09-02"],
  ["/blog/google-cloud-api-key-18000-bill-2026", "2026-09-02"],
  ["/blog/google-cloud-mcp-agent-identity-2026", "2026-09-02"],
  ["/blog/helicone-alternative", "2026-08-28"],
  ["/blog/lakera-alternative", "2026-08-28"],
  ["/blog/microsoft-mcp-control-plane-2026", "2026-09-02"],
  ["/blog/owasp-ai-top-10-2025", "2026-08-28"],
  ["/blog/portkey-alternative", "2026-08-28"],
  ["/blog/prompt-injection-production-attack-patterns", "2026-08-28"],
  ["/blog/reduce-llm-api-costs-60-percent", "2026-09-23"],
  ["/blog/replit-agent-production-database-incident", "2026-09-02"],
  ["/solutions/fintech", "2026-09-23"],
  ["/solutions/healthcare", "2026-08-28"],
  ["/solutions/enterprise", "2026-09-23"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(([route, lastModified]) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
  }));
}
