"use client";

import { useState } from "react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

type IntegrationStatus = "Available" | "Planned" | "Coming soon";

interface IntegrationItem {
  name: string;
  category: string;
  icon: string;
  status: IntegrationStatus;
  description: string;
}

const CATEGORIES = [
  "All",
  "CI/CD",
  "Communication",
  "LLM Providers",
  "Monitoring",
  "Security",
  "Identity & Auth",
];

const ICON_GH = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.26.82-.577 0-.285-.01-1.04-.016-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.775.418-1.305.76-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.468-2.382 1.236-3.222-.124-.303-.536-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.655 1.653.243 2.873.12 3.176.77.84 1.235 1.912 1.235 3.222 0 4.61-2.804 5.622-5.476 5.92.43.37.813 1.102.813 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.216.694.825.576C20.565 21.796 24 17.298 24 12 24 5.37 18.63 0 12 0z"/></svg>`;
const ICON_SLACK = `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>`;
const ICON_DOT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><circle cx="12" cy="12" r="9"/></svg>`;

const INTEGRATIONS: IntegrationItem[] = [
  {
    name: "GitHub App / Actions",
    category: "CI/CD",
    status: "Available",
    icon: ICON_GH,
    description:
      "Install the RakshEx GitHub App for PR secret scanning, webhook-driven jobs, and Actions-friendly scan workflows.",
  },
  {
    name: "Slack Webhook",
    category: "Communication",
    status: "Available",
    icon: ICON_SLACK,
    description:
      "Incoming webhook alerts for critical findings, kill-switch events, and budget warnings when SLACK_WEBHOOK_URL is configured.",
  },
  {
    name: "GitLab CI",
    category: "CI/CD",
    status: "Planned",
    icon: ICON_DOT,
    description: "Pipeline integration for merge-request scanning. Not shipped yet.",
  },
  {
    name: "OpenAI / Anthropic / Gemini",
    category: "LLM Providers",
    status: "Coming soon",
    icon: ICON_DOT,
    description:
      "First-party provider connectors for cost attribution. Gateway path exists; dedicated OAuth/setup UX is not GA.",
  },
  {
    name: "Datadog",
    category: "Monitoring",
    status: "Planned",
    icon: ICON_DOT,
    description: "Export security events as custom metrics. Not available yet.",
  },
  {
    name: "Grafana / Prometheus",
    category: "Monitoring",
    status: "Coming soon",
    icon: ICON_DOT,
    description:
      "Prometheus /metrics endpoint exists for operators; hosted Grafana dashboards are not a product integration yet.",
  },
  {
    name: "Snyk / OWASP ZAP",
    category: "Security",
    status: "Planned",
    icon: ICON_DOT,
    description: "Third-party SAST/DAST bridges are roadmap items, not Available.",
  },
  {
    name: "Vanta / Drata",
    category: "Security",
    status: "Planned",
    icon: ICON_DOT,
    description: "Compliance evidence export to GRC tools is planned — not a shipped connector.",
  },
  {
    name: "Microsoft Teams / PagerDuty",
    category: "Communication",
    status: "Planned",
    icon: ICON_DOT,
    description: "Additional chat/on-call destinations beyond Slack webhook.",
  },
  {
    name: "Auth0 / Clerk / WorkOS",
    category: "Identity & Auth",
    status: "Planned",
    icon: ICON_DOT,
    description: "Enterprise IdP connectors beyond current SSO scaffolding.",
  },
];

function statusBadgeClass(status: IntegrationStatus): string {
  if (status === "Available") return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
  if (status === "Coming soon") return "bg-amber-500/10 border-amber-500/30 text-amber-200/80";
  return "bg-white/5 border-white/15 text-white/50";
}

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filteredIntegrations =
    activeCategory === "All"
      ? INTEGRATIONS
      : INTEGRATIONS.filter((item) => item.category === activeCategory);

  const categoriesToShow =
    activeCategory === "All"
      ? Array.from(new Set(INTEGRATIONS.map((item) => item.category)))
      : [activeCategory];

  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8 selection:bg-teal-accent selection:text-black">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 border-b border-neutral-900 pb-8">
          <h1 className="text-[40px] font-bold text-white font-manrope tracking-tight mb-3">
            Find an Integration
          </h1>
          <p className="text-base text-white/50 font-sans">
            Only GitHub and Slack webhook are Available today. Everything else is honestly labeled
            Planned or Coming soon.
          </p>
        </header>

        <div className="flex flex-col md:flex-row gap-10 items-start">
          <aside className="w-full md:w-[240px] shrink-0">
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
                        : "bg-transparent border border-neutral-800 text-neutral-400"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

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

              <div className="mt-4">
                <p className="text-[12px] font-bold text-white/35 uppercase tracking-[0.08em] mb-3">
                  Explore more
                </p>
                <a
                  href="mailto:akshay@devpulse.ai?subject=Partner Application"
                  className="block p-5 bg-transparent border border-white/10 rounded-xl hover:border-white/20 transition-all group"
                >
                  <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-teal-accent transition-colors">
                    Become a partner
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Request a partner integration or priority on the roadmap.
                  </p>
                </a>
              </div>
            </div>
          </aside>

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
                          className="relative p-6 bg-transparent border border-white/5 rounded-xl hover:border-white/20 hover:bg-[#1a1a1a] transition-all flex flex-col justify-between h-[180px]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 overflow-hidden text-white">
                                  <div
                                    className="w-5 h-5 flex items-center justify-center"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.icon) }}
                                  />
                                </div>
                                <h3 className="text-[15px] font-semibold text-white leading-[1.3] pr-16">
                                  {item.name}
                                </h3>
                              </div>
                              <span
                                className={`absolute top-4 right-4 border text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadgeClass(item.status)}`}
                              >
                                {item.status}
                              </span>
                            </div>
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
