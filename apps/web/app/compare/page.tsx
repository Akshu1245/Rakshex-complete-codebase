"use client";

import Link from "next/link";

const COMPETITORS = [
  {
    slug: "snyk",
    name: "Snyk",
    tagline: "Scans code and dependencies before ship; no runtime action authorization for agents.",
  },
  {
    slug: "datadog",
    name: "Datadog",
    tagline:
      "Observes and alerts after the fact; no concept of authorizing an action before it runs.",
  },
  {
    slug: "traceable-ai",
    name: "Traceable AI",
    tagline:
      "Enterprise REST/GraphQL API security, no delegated authority or semantic action model.",
  },
  {
    slug: "salt-security",
    name: "Salt Security",
    tagline: "ML-based API anomaly detection, not built for AI agent delegated authority.",
  },
  {
    slug: "noname-security",
    name: "Noname Security",
    tagline: "API discovery and posture management, no AI agent authorization layer.",
  },
  {
    slug: "lakera",
    name: "Lakera Guard",
    tagline: "Detects prompt injection at the input layer; RaksHex authorizes the action itself.",
  },
  {
    slug: "portkey",
    name: "Portkey / Helicone",
    tagline: "Routes and logs LLM traffic; doesn't decide whether an action should be allowed.",
  },
  {
    slug: "helicone",
    name: "Helicone",
    tagline: "LLM request logging and tracing, not action-level authorization or enforcement.",
  },
  {
    slug: "langsmith",
    name: "LangSmith",
    tagline: "LLM run tracing and debugging, not runtime authorization or credential enforcement.",
  },
];

export default function ComparisonIndex() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-24 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/60 mb-4">
            ⚖️ Competitive Analysis
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Compare RaksHex
          </h1>
          <p className="text-slate-400 mt-2 text-base">
            Honest comparisons with traditional code scanners, observability engines, and legacy API
            protection tools.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {COMPETITORS.map((comp) => (
            <Link
              key={comp.slug}
              href={`/compare/${comp.slug}`}
              className="block bg-slate-900/30 border border-slate-900 hover:border-blue-500/50 p-6 rounded-xl transition-all group"
            >
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                RaksHex vs {comp.name}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{comp.tagline}</p>
              <span className="text-xs text-blue-400 group-hover:underline font-semibold flex items-center gap-1">
                View full comparison{" "}
                <span className="group-hover:translate-x-1 transition-transform inline-block">
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
