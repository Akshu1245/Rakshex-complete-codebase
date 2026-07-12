"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ChangelogSection() {
  const entries = [
    {
      date: "July 2026",
      title: "Published customer legal, privacy, and security documentation",
      link: "/legal",
    },
    {
      date: "May 2026",
      title: "Interactive demo scanner with Postman parsing",
      link: "/changelog#demo-scanner",
    },
    {
      date: "May 2026",
      title: "Waitlist system with email confirmation",
      link: "/changelog#waitlist",
    },
    {
      date: "April 2026",
      title: "AgentGuard kill-switch controls added",
      link: "/changelog#kill-switch",
    },
  ];

  return (
    <section className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center justify-center gap-10 bg-transparent px-6 py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-[32px] font-bold leading-tight text-white">Changelog</h2>
        <p className="mt-1 text-lg leading-relaxed text-neutral-400">
          See what&apos;s new in RakshEx
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-[1256px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {entries.map((entry) => (
          <Link
            key={entry.title}
            href={entry.link}
            className="group flex h-50 flex-col gap-2.5 rounded-md border border-white/10 bg-transparent p-6 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/5"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {entry.date}
            </span>
            <p className="mt-1 line-clamp-3 text-base font-semibold leading-snug text-white transition-colors duration-150 group-hover:text-[#14B8A6]">
              {entry.title}
            </p>
          </Link>
        ))}
      </div>
      <Link
        className="mt-2 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-white"
        href="/changelog"
      >
        View all changes
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
