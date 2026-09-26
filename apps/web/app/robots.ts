import type { MetadataRoute } from "next";

// Deliberate crawler posture (reviewed 2026-09-26):
// - Retrieval/search bots are explicitly allowed: they power AI answers
//   (ChatGPT search, Claude search, Perplexity) and AI Overviews.
// - Training bots are disallowed: per each vendor's own docs this opts out
//   of model training WITHOUT removing the site from AI answers or search.
//   Reversible — flip to allow if training inclusion is ever wanted.
const AI_RETRIEVAL_BOTS = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Googlebot",
  "Bingbot",
];

const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"];

// App surfaces: authenticated or internal, never for indexing.
const APP_DISALLOW = [
  "/admin/",
  "/api/",
  "/dashboard/",
  "/settings/",
  "/billing/",
  "/enterprise/",
  "/incidents/",
  "/api-keys/",
  "/audit-log/",
  "/workspace/",
  "/collections/",
  "/exports/",
  "/findings/",
  "/metrics/",
  "/notifications/",
  "/playbooks/",
  "/quick-scan/",
  "/scanning/",
  "/shadow-apis/",
  "/kill-switch/",
  "/control-plane/",
  "/projects/",
  "/report/",
  "/invite/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/mfa",
  "/onboarding",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_TRAINING_BOTS,
        disallow: "/",
      },
      {
        userAgent: ["*", ...AI_RETRIEVAL_BOTS],
        allow: "/",
        disallow: APP_DISALLOW,
      },
    ],
    sitemap: "https://www.rakshex.in/sitemap.xml",
    host: "https://www.rakshex.in",
  };
}
