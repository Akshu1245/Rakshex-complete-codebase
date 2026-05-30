"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ChangelogSection() {
  const entries = [
    {
      date: "MAY 2026",
      title: "Interactive Demo Scanner",
      description:
        "Launch of our real-time Postman and OpenAPI collection parser. Scan, score, and analyze endpoints directly from the sandbox interface.",
      link: "/changelog#demo-scanner",
    },
    {
      date: "MAY 2026",
      title: "Waitlist Confirmation System",
      description:
        "Secure, transactional waitlist flow deployed to track over 500+ private beta requests. Built-in email verification and instant access tokens.",
      link: "/changelog#waitlist",
    },
    {
      date: "APRIL 2026",
      title: "AgentGuard Kill Switch Engine",
      description:
        "A sub-second autonomous API circuit breaker. Monitors tool execution frequency, spending thresholds, and locks compromised agents.",
      link: "/changelog#kill-switch",
    },
  ];

  return (
    <section className="relative w-full max-w-[800px] mx-auto py-24 px-6 select-none bg-transparent">
      <div className="w-full flex flex-col gap-12">
        {/* Section Header */}
        <div className="flex flex-col gap-3 items-center text-center mb-6">
          <span className="text-xs font-bold text-[#14B8A6] uppercase tracking-widest bg-[#14B8A6]/10 px-3 py-1 rounded-full border border-[#14B8A6]/20">
            Timeline
          </span>
          <h2 className="text-3xl md:text-[36px] font-bold tracking-[-0.01em] text-white mt-2 font-sans">
            What's New
          </h2>
          <p className="text-[#9CA3AF] font-sans text-base max-w-lg mt-1">
            Recent releases and security milestones from the RaksHex team.
          </p>
        </div>

        {/* Timeline Line Container */}
        <div className="relative pl-8 md:pl-10 space-y-12">
          {/* Vertical line: 2px solid #14B8A6 */}
          <div className="absolute left-[3px] md:left-[4px] top-2 bottom-2 w-[2px] bg-[#14B8A6]" />

          {entries.map((entry, idx) => (
            <div key={idx} className="relative group text-left">
              {/* Dot: 8px circle, teal background, white border */}
              <div className="absolute -left-[33px] md:-left-[41px] top-4.5 w-[8px] h-[8px] rounded-full bg-[#14B8A6] border border-white group-hover:scale-150 group-hover:bg-white group-hover:border-[#14B8A6] transition-all duration-200" />

              {/* Content block */}
              <Link
                href={entry.link}
                className="block p-3 rounded-lg hover:bg-[#14B8A6]/5 hover:translate-x-1 transition-all duration-200"
              >
                <div className="flex flex-col gap-1">
                  {/* Date: teal, 12px */}
                  <span className="text-[#14B8A6] font-mono text-[12px] font-semibold tracking-wider">
                    {entry.date}
                  </span>

                  {/* Title: White, 18px, weight 600 */}
                  <h3 className="text-white text-[18px] font-semibold font-sans group-hover:text-[#14B8A6] transition-colors duration-150">
                    {entry.title}
                  </h3>

                  {/* Description: Gray (#9CA3AF), 14px */}
                  <p className="text-[#9CA3AF] text-[14px] leading-relaxed font-sans mt-1">
                    {entry.description}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Footer Link */}
        <div className="text-center mt-6">
          <Link
            className="inline-flex items-center gap-2 text-sm text-[#14B8A6] hover:text-[#0D9488] transition-colors font-sans font-medium"
            href="/changelog"
          >
            View all changes
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
