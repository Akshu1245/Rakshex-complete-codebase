"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ChangelogSection() {
  const entries = [
    {
      date: "May 2026",
      title: "Interactive Demo Scanner with real Postman parsing",
      link: "/changelog#demo-scanner",
    },
    {
      date: "May 2026",
      title: "Waitlist system with email confirmation",
      link: "/changelog#waitlist",
    },
    {
      date: "April 2026",
      title: "AgentGuard Kill Switch engine launched",
      link: "/changelog#kill-switch",
    },
    {
      date: "April 2026",
      title: "Four provisional patents filed (NHCE/DEV/2026/001–004)",
      link: "/changelog#patents",
    },
  ];

  return (
    <section className="relative w-full max-w-[1280px] mx-auto flex flex-col gap-10 items-center justify-center py-24 px-6 bg-transparent">
      {/* Section Header */}
      <div className="flex flex-col gap-3 items-center text-center">
        <h2 className="text-[32px] leading-tight font-bold text-white font-sans tracking-[-0.02em]">
          Changelog
        </h2>
        <p className="text-neutral-400 text-lg leading-relaxed font-sans mt-1">
          See what's new in RakshEx
        </p>
      </div>

      {/* Grid of Clickable Cards */}
      <div className="max-w-[1256px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {entries.map((entry, idx) => (
          <Link
            key={idx}
            href={entry.link}
            className="h-50 group flex flex-col gap-2.5 p-6 rounded-md bg-transparent hover:bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider font-mono">
                {entry.date}
              </span>
            </div>
            <p className="text-white text-base leading-snug font-sans font-semibold group-hover:text-[#14B8A6] transition-colors duration-150 line-clamp-3 mt-1">
              {entry.title}
            </p>
          </Link>
        ))}
      </div>

      {/* Footer Link */}
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors font-sans mt-2"
        href="/changelog"
      >
        View all changes
        <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}
