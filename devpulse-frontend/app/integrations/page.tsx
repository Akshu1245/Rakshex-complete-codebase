"use client";

import { useState } from "react";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

interface IntegrationItem {
  name: string;
  category: string;
  icon: string;
  status: "Available" | "Coming Soon";
  description: string;
}

const CATEGORIES = [
  "All",
  "LLM Providers",
  "API Frameworks",
  "CI/CD",
  "Monitoring",
  "Security",
  "Communication",
  "Identity & Auth",
];

const INTEGRATIONS: IntegrationItem[] = [
  // LLM Providers
  {
    name: "OpenAI for RakshEx",
    category: "LLM Providers",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.080.080 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.076 14.5A4.5 4.5 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387 2.02-1.168a.076.076 0 0 1 .071 0l4.742 2.738a4.5 4.5 0 0 1-.695 8.118v-5.681a.79.79 0 0 0-.405-.62zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.74-2.736a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>`,
    description:
      "Connect OpenAI GPT-4, o1, and o3 models to RakshEx. Full cost attribution, token tracking, and anomaly detection.",
  },
  {
    name: "Anthropic Claude for RakshEx",
    category: "LLM Providers",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M17.304 3.541 13.766 13.38H10.23L6.696 3.541H3.541L8.651 17.5h6.698l5.11-13.959h-3.155zM3.541 20.459h16.918v-2.383H3.541v2.383z"/></svg>`,
    description:
      "Monitor Claude API usage, isolate thinking tokens, and block prompt injection with RakshEx runtime governance.",
  },
  {
    name: "Google Gemini for RakshEx",
    category: "LLM Providers",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M11.04 0h1.92C13.92 6.912 17.088 10.08 24 11.04v1.92c-6.912.96-10.08 4.128-10.04 11.04h-1.92C11.04 17.088 7.872 13.92.96 12.96v-1.92C7.872 10.08 11.04 6.912 11.04 0z"/></svg>`,
    description:
      "Track Gemini API costs per model tier, detect anomalies, and enforce budget caps via the RakshEx kill switch.",
  },
  {
    name: "Mistral AI for RakshEx",
    category: "LLM Providers",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M0 0h4v4H0zm6.667 0h4v4h-4zM0 6.667h4v4H0zm6.667 0h4v4h-4zm6.666 0h4v4h-4zM13.333 0h4v4h-4zM20 0h4v4h-4zm0 6.667h4v4h-4zM0 13.333h4v4H0zm6.667 0h4v4h-4zm13.333 0h4v4h-4zM0 20h4v4H0zm6.667 0h4v4h-4zm6.666 0h4v4h-4zm6.667 0h4v4h-4z"/></svg>`,
    description:
      "Full Mistral API observability. Per-endpoint cost breakdown, rate limit detection, and compliance reporting.",
  },
  {
    name: "Cohere for RakshEx",
    category: "LLM Providers",
    status: "Available",
    icon: `<div class="w-full h-full flex items-center justify-center font-bold text-teal-accent text-sm font-mono">Co</div>`,
    description:
      "Monitor Cohere Command and Embed API usage. Cost alerts, usage anomalies, and OWASP AI mapping.",
  },
  {
    name: "AWS Bedrock for RakshEx",
    category: "LLM Providers",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
    description:
      "Multi-model Bedrock monitoring. Track Claude, Titan, and Llama usage with unified cost attribution.",
  },

  // API Frameworks
  {
    name: "FastAPI Integration",
    category: "API Frameworks",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M12 0C5.375 0 0 5.375 0 12c0 6.626 5.375 12.001 12 12.001 6.626 0 12.001-5.375 12.001-12C24.001 5.375 18.626 0 12 0zm-.624 21.619v-7.227H7.19L13.203 2.38v7.227h4.029L11.376 21.62z"/></svg>`,
    description:
      "Automatic route extraction, shadow API detection, and middleware injection for FastAPI applications.",
  },
  {
    name: "Express.js Integration",
    category: "API Frameworks",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M24 18.588a1.529 1.529 0 0 1-1.895-.72l-3.45-4.771-.5-.667-4.003 5.444a1.466 1.466 0 0 1-1.802.708l5.158-6.92-4.798-6.251a1.595 1.595 0 0 1 1.9.666l3.576 4.83 3.596-4.81a1.435 1.435 0 0 1 1.788-.668L21.708 7.9l-2.522 3.283a.666.666 0 0 0 0 .994l4.804 6.412zM.002 11.576l.42-2.075c1.154-4.103 5.858-5.81 9.094-3.27 1.895 1.489 2.368 3.597 2.275 5.973H1.116C.943 16.447 4.005 19.009 7.92 17.7a4.078 4.078 0 0 0 2.582-2.876c.207-.666.548-.78 1.174-.588a5.417 5.417 0 0 1-2.589 3.957 6.272 6.272 0 0 1-7.306-.933 6.575 6.575 0 0 1-1.64-3.348c-.061-.27-.127-.539-.194-.808-.003-.arbitrary-.002-.016 0 0v-.528zm1.114-.7h8.97c-.049-3.001-1.8-5.12-4.3-5.12-2.73.002-4.4 2.088-4.67 5.12z"/></svg>`,
    description:
      "Scan Express routes for auth gaps, inject RakshEx middleware, and monitor LLM calls in Node.js apps.",
  },
  {
    name: "Django REST Integration",
    category: "API Frameworks",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M11.146 0h3.924v18.166c-2.013.382-3.491.535-5.096.535-4.791 0-7.288-2.166-7.288-6.32 0-4.002 2.65-6.6 6.753-6.6.637 0 1.121.05 1.707.203zm0 9.143a3.894 3.894 0 0 0-1.325-.204c-1.988 0-3.134 1.223-3.134 3.365 0 2.09 1.096 3.236 3.109 3.236.433 0 .79-.025 1.35-.102V9.142zM21.314 6.06v11.49c0 3.97-.292 5.88-1.146 7.529-.802 1.57-1.86 2.57-4.055 3.66l-3.644-1.733c2.194-1.02 3.252-1.942 3.93-3.34.714-1.42.944-3.04.944-7.326V6.06h3.97zm-4.06-5.98h3.97V4.04h-3.97V.08z"/></svg>`,
    description:
      "Django REST Framework scanner. Detect missing auth, BOLA vulnerabilities, and exposed PII endpoints.",
  },
  {
    name: "Flask Integration",
    category: "API Frameworks",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    description:
      "Flask app security scanning. Route extraction, credential detection, and real-time anomaly monitoring.",
  },
  {
    name: "Spring Boot Integration",
    category: "API Frameworks",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19"/></svg>`,
    description:
      "Java Spring Boot API scanning. OWASP Top 10 detection, auth gap analysis, and compliance reports.",
  },
  {
    name: "NestJS Integration",
    category: "API Frameworks",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M14.131.047C11.771-.145 9.475.49 7.672 1.767c.025 0 .055-.005.08-.005 2.16 0 4.14 1.065 5.544 2.835.504.637.95 1.374 1.34 2.18.304.623.57 1.306.795 2.04.38 1.24.575 2.61.575 4.01 0 1.4-.195 2.77-.576 4.01-.225.734-.49 1.417-.795 2.04-.39.806-.836 1.543-1.34 2.18-1.285 1.625-3.07 2.68-5.024 2.838.604.14 1.227.215 1.864.215 5.085 0 9.21-4.125 9.21-9.21S19.216 5.257 14.131.047z"/></svg>`,
    description:
      "TypeScript-native NestJS scanning. Decorator-aware route analysis and middleware injection support.",
  },

  // CI/CD
  {
    name: "GitHub Actions for RakshEx",
    category: "CI/CD",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M10.984 13.836a.5.5 0 0 1-.353-.146l-3.5-3.5a.5.5 0 1 1 .706-.708l3.146 3.146 8.146-8.146a.5.5 0 0 1 .707.707l-8.5 8.5a.5.5 0 0 1-.353.146zm-3.476 6.696a.5.5 0 0 1-.353-.854l3.5-3.5a.5.5 0 0 1 .707.707l-3.5 3.5a.5.5 0 0 1-.354.147zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>`,
    description:
      "Run RakshEx scans on every PR. Security score, cost delta, and vulnerability count as PR comments.",
  },
  {
    name: "GitLab CI Integration",
    category: "CI/CD",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M23.953 4.57a1 1 0 00-.373-.405L12 .067 1.077 4.165a1 1 0 00-.373.405L0 12.304l12 11.629 12-11.629-1.077-7.734z"/></svg>`,
    description:
      "GitLab pipeline integration. Block merges when security score drops below your defined threshold.",
  },
  {
    name: "Vercel Integration",
    category: "CI/CD",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M24 22.525H0L12 1.475l12 21.05z"/></svg>`,
    description:
      "Scan your Vercel deployment on every push. Preview URL scanning before production goes live.",
  },
  {
    name: "CircleCI Integration",
    category: "CI/CD",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>`,
    description:
      "CircleCI orb for RakshEx. One-line addition to your config.yml for full API security scanning.",
  },
  {
    name: "Jenkins Integration",
    category: "CI/CD",
    status: "Coming Soon",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    description:
      "Jenkins pipeline plugin for RakshEx scanning. ETA Based on internal benchmark methodology.",
  },

  // Monitoring
  {
    name: "Datadog Integration",
    category: "Monitoring",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>`,
    description:
      "Send RakshEx security events and cost anomalies to your Datadog dashboard as custom metrics.",
  },
  {
    name: "Grafana Integration",
    category: "Monitoring",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>`,
    description:
      "Grafana dashboard template for RakshEx. Visualize security scores, cost trends, and findings over time.",
  },
  {
    name: "Prometheus Integration",
    category: "Monitoring",
    status: "Coming Soon",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
    description:
      "Export RakshEx metrics to Prometheus. ETA Based on internal benchmark methodology.",
  },

  // Security
  {
    name: "Snyk Integration",
    category: "Security",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    description:
      "Combine Snyk SAST with RakshEx runtime governance. Code + API security in one unified pipeline.",
  },
  {
    name: "OWASP ZAP Integration",
    category: "Security",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    description:
      "Complement DAST scanning with RakshEx LLM-specific checks not covered by traditional scanners.",
  },
  {
    name: "Vanta Integration",
    category: "Security",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
    description:
      "Feed RakshEx compliance reports directly into Vanta for automated SOC2 evidence collection.",
  },
  {
    name: "Drata Integration",
    category: "Security",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 12l2 2 4-4"/></svg>`,
    description:
      "Sync RakshEx compliance data to Drata. Auto-populate security controls with real scan evidence.",
  },

  // Communication
  {
    name: "Slack Integration",
    category: "Communication",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>`,
    description:
      "Real-time Slack alerts for security findings, cost anomalies, and kill switch triggers.",
  },
  {
    name: "Microsoft Teams Integration",
    category: "Communication",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    description:
      "Teams webhook integration. Get RakshEx alerts and weekly security digests in your channels.",
  },
  {
    name: "PagerDuty Integration",
    category: "Communication",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v16M2 10h20M2 14h20"/></svg>`,
    description:
      "Escalate critical RakshEx findings to PagerDuty. On-call alerts for P0 security events.",
  },

  // Identity & Auth
  {
    name: "Auth0 Integration",
    category: "Identity & Auth",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    description:
      "Validate JWT tokens from Auth0 in RakshEx middleware. SSO and enterprise authentication support.",
  },
  {
    name: "Clerk Integration",
    category: "Identity & Auth",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    description:
      "Clerk authentication monitoring. Detect auth bypass attempts on Clerk-protected endpoints.",
  },
  {
    name: "WorkOS Integration",
    category: "Identity & Auth",
    status: "Available",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>`,
    description:
      "Enterprise SSO via WorkOS. SCIM directory sync and organization-level access control for RakshEx.",
  },
];

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filteredIntegrations =
    activeCategory === "All"
      ? INTEGRATIONS
      : INTEGRATIONS.filter((item) => item.category === activeCategory);

  // Group filtered integrations by category to stack them nicely on "All"
  const categoriesToShow =
    activeCategory === "All"
      ? Array.from(new Set(INTEGRATIONS.map((item) => item.category)))
      : [activeCategory];

  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8 selection:bg-teal-accent selection:text-black">
      <div className="max-w-7xl mx-auto">
        {/* PAGE HEADER */}
        <header className="mb-12 border-b border-neutral-900 pb-8">
          <h1 className="text-[40px] font-bold text-white font-manrope tracking-tight mb-3">
            Find an Integration
          </h1>
          <p className="text-base text-white/50 font-sans">Use your favorite tools with RakshEx.</p>
        </header>

        {/* TWO-COLUMN LAYOUT */}
        <div className="flex flex-col md:flex-row gap-10 items-start">
          {/* LEFT COLUMN: Sidebar */}
          <aside className="w-full md:w-[240px] shrink-0">
            {/* Mobile Horizontal Filter list */}
            <div className="md:hidden flex flex-row overflow-x-auto whitespace-nowrap gap-2 pb-4 scrollbar-none mb-6">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      isActive
                        ? "bg-teal-accent text-white"
                        : "bg-[#141414] border border-neutral-800 text-neutral-400"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Desktop Vertical Categories list */}
            <div className="hidden md:flex flex-col gap-6">
              <div>
                <p className="text-[12px] font-bold text-white/35 uppercase tracking-[0.08em] mb-3">
                  Categories
                </p>
                <nav className="flex flex-col gap-1">
                  {CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`text-left px-3 py-2 text-sm font-medium transition-all border-l-2 cursor-pointer ${
                          isActive
                            ? "border-teal-accent text-white bg-white/[0.02]"
                            : "border-transparent text-white/50 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Become a partner card */}
              <div className="mt-4">
                <p className="text-[12px] font-bold text-white/35 uppercase tracking-[0.08em] mb-3">
                  Explore more
                </p>
                <a
                  href="mailto:akshay@rakshex.in?subject=Partner Application"
                  className="block p-5 bg-[#141414] border border-white/10 rounded-xl hover:border-white/20 transition-all group"
                >
                  <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center text-white/70 mb-4 group-hover:text-white transition-colors border border-neutral-800">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-teal-accent transition-colors">
                    Become a partner
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Fill out a quick 30 second form to apply to become a partner
                  </p>
                </a>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: Integration grid */}
          <main className="flex-1 w-full">
            <div className="space-y-12">
              {categoriesToShow.map((catTitle) => {
                const items = filteredIntegrations.filter((item) => item.category === catTitle);
                if (items.length === 0) return null;

                return (
                  <section key={catTitle} className="space-y-6">
                    <h2 className="text-[28px] font-semibold text-white font-manrope">
                      {catTitle}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((item) => (
                        <div
                          key={item.name}
                          className="relative p-6 bg-[#141414] border border-white/5 rounded-xl hover:border-white/20 hover:bg-[#1a1a1a] transition-all cursor-pointer flex flex-col justify-between h-[180px]"
                        >
                          <div>
                            {/* Top row */}
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 overflow-hidden text-white">
                                  <div
                                    className="w-5 h-5 flex items-center justify-center"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.icon) }}
                                  />
                                </div>
                                <h3 className="text-[15px] font-semibold text-white leading-[1.3] pr-10">
                                  {item.name}
                                </h3>
                              </div>

                              {/* Status Badge */}
                              {item.status === "Coming Soon" && (
                                <span className="absolute top-4 right-4 bg-white/5 border border-white/15 text-white/50 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                                  Coming Soon
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-[13px] text-white/50 leading-[1.5] line-clamp-3">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
