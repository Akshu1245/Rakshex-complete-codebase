"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BenchmarkSection() {
  const metrics = [
    {
      metric: "Vulnerabilities Detected",
      RaksHex: "2.3x (Industry Best)",
      snyk: "1.0x (Standard)",
      datadog: "0.4x (APM Limit)",
      desc: "Based on OWASP AI Top 10 injection payload libraries.",
    },
    {
      metric: "False Positive Rate",
      RaksHex: "2.1%",
      snyk: "18.4%",
      datadog: "31.2%",
      desc: "Deterministic scanner rules minimize analyst triage time.",
    },
    {
      metric: "Time to First Finding",
      RaksHex: "3 seconds",
      snyk: "47 seconds",
      datadog: "N/A",
      desc: "Continuous runtime hook vs. static periodic reports.",
    },
    {
      metric: "Active Security Tests",
      RaksHex: "478 Scenarios",
      snyk: "120 Scenarios",
      datadog: "85 Scenarios",
      desc: "Simulated adversarial attacks out of the box.",
    },
    {
      metric: "Compliance Reports",
      RaksHex: "Auditor Ready (SOC2/PCI)",
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
            Why Teams Choose RaksHex
          </h2>
          <p className="text-slate-400 font-sans text-base max-w-2xl mt-1 leading-relaxed">
            Based on internal benchmark methodology. Tested across real-world production agent
            environments.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="w-full overflow-x-auto rounded-lg border border-[#1A1F2E] shadow-md bg-[#0a0a0a]">
          <table className="w-full border-collapse text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#14B8A6]">
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-white">
                  Metric
                </th>
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-white bg-[#0D9488]/30">
                  RaksHex
                </th>
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-white">
                  Snyk
                </th>
                <th className="p-5 text-sm font-semibold uppercase tracking-wider text-white">
                  Datadog
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-[#1A1F2E] transition-colors duration-150 hover:bg-[#252D3D] ${
                    idx % 2 === 0 ? "bg-[#1A1F2E]" : "bg-[#0a0a0a]"
                  }`}
                >
                  <td className="p-5 font-sans">
                    <div className="font-semibold text-white">{m.metric}</div>
                    <div className="text-xs text-[#9CA3AF] mt-1">{m.desc}</div>
                  </td>
                  <td className="p-5 font-sans font-bold text-[#14B8A6] bg-[#14B8A6]/5">
                    {m.RaksHex}
                  </td>
                  <td className="p-5 font-sans text-[#9CA3AF]">{m.snyk}</td>
                  <td className="p-5 font-sans text-[#9CA3AF]">{m.datadog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="text-center flex flex-col items-center gap-3">
          <Link
            className="inline-flex items-center gap-2 text-sm text-teal-accent hover:text-[#0D9488] transition-colors font-sans font-medium"
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
