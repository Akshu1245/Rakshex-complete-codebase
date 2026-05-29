"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Zap, Mail, ShieldAlert, Award } from "lucide-react";

export function ChangelogSection() {
  const entries = [
    {
      date: "May 2026",
      title: "Interactive Demo Scanner",
      description:
        "Launch of our real-time Postman and OpenAPI collection parser. Scan, score, and analyze endpoints directly from the sandbox interface.",
      link: "/changelog#demo-scanner",
      icon: Zap,
    },
    {
      date: "May 2026",
      title: "Waitlist Confirmation System",
      description:
        "Secure, transactional waitlist flow deployed to track over 500+ private beta requests. Built-in email verification and instant access tokens.",
      link: "/changelog#waitlist",
      icon: Mail,
    },
    {
      date: "April 2026",
      title: "AgentGuard Kill Switch Engine",
      description:
        "A sub-second autonomous API circuit breaker. Monitors tool execution frequency, spending thresholds, and locks compromised agents.",
      link: "/changelog#kill-switch",
      icon: ShieldAlert,
    },
    {
      date: "April 2026",
      title: "Four Provisional Patents Filed",
      description:
        "Patents successfully filed (NHCE/DEV/2026/001-004) covering reasoning token isolation, runtime firewalls, and adaptive cost models.",
      link: "/changelog#patents",
      icon: Award,
    },
  ];

  return (
    <section className="relative max-w-[900px] mx-auto flex flex-col gap-12 items-stretch justify-center py-24 px-6 select-none bg-transparent">
      {/* Section Header */}
      <div className="flex flex-col gap-3 items-center text-center">
        <span className="text-xs font-bold text-teal-accent uppercase tracking-widest bg-teal-accent/10 px-3 py-1 rounded-full border border-teal-accent/20">
          Timeline
        </span>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.01em] text-white mt-2">
          What's New
        </h2>
        <p className="text-slate-400 font-sans text-base max-w-lg mt-1">
          Recent releases and security milestones from the RakshEx team.
        </p>
      </div>

      {/* Changelog Vertical Stack */}
      <div className="flex flex-col gap-6 w-full">
        {entries.map((entry, idx) => {
          const Icon = entry.icon;
          return (
            <Link
              key={idx}
              href={entry.link}
              className="group flex flex-col md:flex-row gap-6 p-7 rounded-xl bg-slate-dark/30 hover:bg-slate-dark/50 border border-[#2D3E50] hover:border-teal-accent border-l-4 border-l-teal-accent hover:border-l-electric-cyan transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(6,214,160,0.1)]"
            >
              {/* Left Side: Icon */}
              <div className="flex items-start shrink-0">
                <div className="p-3.5 rounded-lg bg-[#0c101d] text-teal-accent group-hover:text-electric-cyan transition-colors border border-[#2D3E50]">
                  <Icon className="w-6 h-6" />
                </div>
              </div>

              {/* Right Side: Content */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {entry.date}
                  </span>
                  <span className="text-teal-accent opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">
                    &rarr;
                  </span>
                </div>
                <h3 className="text-white text-xl font-bold font-sans group-hover:text-teal-accent transition-colors leading-tight">
                  {entry.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-1 font-sans">
                  {entry.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer Link */}
      <div className="text-center mt-4">
        <Link
          className="inline-flex items-center gap-2 text-sm text-teal-accent hover:text-electric-cyan transition-all font-sans font-medium"
          href="/changelog"
        >
          View all changes
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
