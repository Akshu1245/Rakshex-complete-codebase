import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/dashboard/", "/settings/", "/billing/"],
    },
    sitemap: "https://www.rakshex.in/sitemap.xml",
    host: "https://www.rakshex.in",
  };
}
