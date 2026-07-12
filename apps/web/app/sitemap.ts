import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rakshex.in";

const routes = [
  "",
  "/pricing",
  "/privacy",
  "/terms",
  "/cookies",
  "/legal",
  "/demo",
  "/compare",
  "/compare/helicone",
  "/compare/portkey",
  "/compare/lakera",
  "/compare/langsmith",
  "/compare/datadog",
  "/compare/snyk",
  "/blog",
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
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : 0.7,
  }));
}
