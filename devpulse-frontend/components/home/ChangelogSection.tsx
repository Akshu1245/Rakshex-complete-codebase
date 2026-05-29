"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ChangelogSection() {
  const entries = [
    {
      date: "May 2026",
      title: "Interactive Demo Scanner",
      description: "Demo scanner with real Postman collection parsing.",
      link: "/changelog#demo-scanner",
    },
    {
      date: "May 2026",
      title: "Waitlist Confirmation",
      description: "Secure waitlist system with transactional email confirmations.",
      link: "/changelog#waitlist",
    },
    {
      date: "April 2026",
      title: "AgentGuard Kill Switch",
      description: "Sub-second autonomous API circuit breaker engine launch.",
      link: "/changelog#kill-switch",
    },
    {
      date: "April 2026",
      title: "Four Provisional Patents",
      description: "Patents filed for NHCE/DEV/2026/001-004 runtime security.",
      link: "/changelog#patents",
    },
  ];

  return (
    <section className="relative max-w-[1280px] mx-auto flex flex-col gap-10 items-center justify-center py-24 px-6 select-none bg-transparent">
      {/* Section Header */}
      <div className="flex flex-col gap-3 items-center text-center">
        <h2 className="text-[32px] leading-[1.2] font-normal text-white font-manrope">Changelog</h2>
        <p className="text-neutral-400 text-[17px] leading-8 font-normal font-manrope">
          See what's new in RakshEx
        </p>
      </div>

      {/* Changelog Grid */}
      <div className="max-xl:max-w-[680px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {entries.map((entry, idx) => (
          <Link
            key={idx}
            href={entry.link}
            className="h-48 group flex flex-col gap-3.5 p-6 rounded-lg bg-[#141414] hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all duration-200"
          >
            <div className="flex items-center">
              <span className="text-[#00d4aa] text-xs font-mono font-semibold uppercase tracking-wider">
                {entry.date}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-white text-base font-semibold font-manrope group-hover:text-[#00d4aa] transition-colors leading-tight">
                {entry.title}
              </h3>
              <p className="text-neutral-400 text-xs leading-normal font-manrope mt-1">
                {entry.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Link */}
      <Link
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-all font-mono mt-4"
        href="/changelog"
      >
        View all changes
        <ArrowRight className="w-4 h-4 ml-1" />
      </Link>
    </section>
  );
}
