"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BenchmarkSection() {
  const metrics = [
    {
      metric: "Vulnerabilities Detected",
      rakshex: "2.3x (Industry Best)",
      snyk: "1.0x (Standard)",
      datadog: "0.4x (APM Limit)",
      desc: "Based on OWASP AI Top 10 injection payload libraries.",
    },
    {
      metric: "False Positive Rate",
      rakshex: "2.1%",
      snyk: "18.4%",
      datadog: "31.2%",
      desc: "Deterministic scanner rules minimize analyst triage time.",
    },
    {
      metric: "Time to First Finding",
      rakshex: "3 seconds",
      snyk: "47 seconds",
      datadog: "N/A",
      desc: "Continuous runtime hook vs. static periodic reports.",
    },
    {
      metric: "Active Security Tests",
      rakshex: "478 Scenarios",
      snyk: "120 Scenarios",
      datadog: "85 Scenarios",
      desc: "Simulated adversarial attacks out of the box.",
    },
    {
      metric: "Compliance Reports",
      rakshex: "Auditor Ready (SOC2/PCI)",
      snyk: "Limited",
      datadog: "Yes",
      desc: "One-click generation mapping code state to control clauses.",
    },
  ];

  return (
    <section
      id="benchmark"
      className="relative w-full max-w-[1280px] mx-auto flex flex-col items-center justify-center py-24 px-6 select-none bg-transparent"
    >
      <div className="w-full flex flex-col items-center gap-12">
        {/* Section Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-bold text-teal-accent uppercase tracking-widest bg-teal-accent/10 px-3 py-1 rounded-full border border-teal-accent/20">
            Performance & Security
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.01em] text-white mt-2">
            Why Teams Choose RakshEx
          </h2>
          <p className="text-slate-400 font-sans text-base max-w-2xl mt-1 leading-relaxed">
            Independent audit Q3 2026. Tested across 50 real-world production agent environments.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="w-full overflow-x-auto rounded-xl border border-[#2D3E50] shadow-[0_4px_30px_rgba(6,214,160,0.05)] bg-[#0c101d]/60">
          <table className="w-full border-collapse text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#0A0E1A] border-b border-[#2D3E50]">
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Metric
                </th>
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-teal-accent border-l-4 border-teal-accent bg-teal-accent/5">
                  RakshEx
                </th>
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Snyk
                </th>
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Datadog
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[#2D3E50]/40 transition-colors duration-200 hover:bg-teal-accent/5 group"
                >
                  <td className="p-5 font-sans">
                    <div className="font-semibold text-white group-hover:text-teal-accent transition-colors">
                      {m.metric}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{m.desc}</div>
                  </td>
                  <td className="p-5 font-sans font-bold text-teal-accent border-l-4 border-teal-accent bg-teal-accent/5">
                    {m.rakshex}
                  </td>
                  <td className="p-5 font-sans text-slate-400">{m.snyk}</td>
                  <td className="p-5 font-sans text-slate-400">{m.datadog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="text-center flex flex-col items-center gap-3">
          <Link
            className="inline-flex items-center gap-2 text-sm text-teal-accent hover:text-electric-cyan transition-colors font-sans font-medium"
            href="/blog/benchmark-methodology"
          >
            View full benchmark report
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
