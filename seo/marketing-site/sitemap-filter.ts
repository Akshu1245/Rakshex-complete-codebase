import type { MetadataRoute } from "next";

/**
 * Call from the MARKETING site's existing app/sitemap.ts, before returning its
 * URLs. Keep all other entries and their lastModified/priority metadata.
 *
 * Do not copy this file into the authenticated dashboard.
 */
const NOINDEX_COMPARISONS = new Set([
  "/compare",
  "/compare/helicone",
  "/compare/portkey",
  "/compare/lakera",
  "/compare/langsmith",
  "/compare/datadog",
  "/compare/snyk",
]);

export function removeNoindexComparisons(
  pages: MetadataRoute.Sitemap,
): MetadataRoute.Sitemap {
  return pages.filter(({ url }) => {
    const path = new URL(url, "https://www.rakshex.in").pathname
      .replace(/\/+$/, "") || "/";
    return !NOINDEX_COMPARISONS.has(path.toLowerCase());
  });
}
