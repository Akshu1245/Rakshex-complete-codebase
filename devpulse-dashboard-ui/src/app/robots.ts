import type { MetadataRoute } from "next";

// The DevPulse dashboard is an application, not the public marketing website.
// Keep its sign-in, API proxies, account pages and operational views out of crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
