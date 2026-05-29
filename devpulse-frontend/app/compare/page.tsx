"use client";

import Link from "next/link";

const COMPETITORS = [
  {
    slug: "snyk",
    name: "Snyk",
    tagline: "Code-level vulnerability scanner, blind to live API and LLM surfaces.",
  },
  {
    slug: "datadog",
    name: "Datadog LLM",
    tagline: "Infrastructure observability giant, but AI security is an afterthought.",
  },
  {
    slug: "traceable-ai",
    name: "Traceable AI",
    tagline: "Enterprise API security, lacking runtime LLM cost attribution & agent firewalls.",
  },
  {
    slug: "salt-security",
    name: "Salt Security",
    tagline: "API anomaly detection, not built for non-deterministic AI agentic flows.",
  },
  {
    slug: "noname-security",
    name: "Noname Security",
    tagline: "Posture management and scanning, missing dynamic prompt injection blocking.",
  },
];

export default function ComparisonIndex() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/60 mb-4">
            ⚖️ Competitive Analysis
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Compare RakshEx
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
              className="block bg-slate-900/30 border border-slate-900 hover:border-blue-500/50 p-6 rounded-2xl transition-all group"
            >
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                RakshEx vs {comp.name}
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
