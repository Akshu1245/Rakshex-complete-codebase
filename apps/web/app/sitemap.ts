import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rakshex.in";

const routes = [
  "",
  "/pricing",
  "/privacy",
  "/terms",
  "/cookies",
  "/legal",
  "/legal/dpa",
  "/legal/sla",
  "/legal/aup",
  "/legal/refund",
  "/legal/subprocessors",
  "/legal/ai-transparency",
  "/dpa",
  "/security",
  "/demo",
  "/compare",
  "/compare/helicone",
  "/compare/portkey",
  "/compare/lakera",
  "/compare/langsmith",
  "/compare/datadog",
  "/compare/snyk",
  "/incidents",
  "/blog",
  "/blog/india-upi-agentic-payments-delegated-spend-2026",
  "/blog/google-cloud-api-key-18000-bill-2026",
  "/blog/claude-code-approval-fatigue-action-policy-2026",
  "/blog/cloudflare-ai-spend-limits-2026",
  "/blog/google-cloud-mcp-agent-identity-2026",
  "/blog/microsoft-mcp-control-plane-2026",
  "/blog/replit-agent-production-database-incident",
  "/blog/helicone-alternative",
  "/blog/portkey-alternative",
  "/blog/lakera-alternative",
  "/roi-calculator",
  "/features",
  "/about",
  "/faq",
  "/trust",
  "/changelog",
  "/integrations",
  "/partners",
  "/open-source",
  "/status",
  "/solutions/fintech",
  "/solutions/healthcare",
  "/solutions/enterprise",
  "/login",
  "/register",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency:
      route === "" || route === "/incidents" || route === "/blog" || route.startsWith("/blog/")
        ? "daily"
        : "monthly",
    priority: route === "" ? 1.0 : route === "/incidents" ? 0.9 : route === "/blog" ? 0.85 : 0.7,
  }));
}
