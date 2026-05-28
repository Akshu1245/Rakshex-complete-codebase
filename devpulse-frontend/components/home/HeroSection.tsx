"use client";

import Link from "next/link";
import { HeroFlowDiagram } from "./HeroFlowDiagram";

export function HeroSection() {
  return (
    <section className="relative w-full max-w-[1280px] mx-auto pt-32 pb-20 px-6 xl:px-8 bg-transparent">
      {/* 50/50 Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* LEFT COLUMN: Content */}
        <div className="flex flex-col items-start text-left">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-1.5 mb-6">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-white"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="font-sans font-medium text-xs sm:text-sm text-white">
              4 Patents Filed &middot; Built in India
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-sans text-[40px] sm:text-[54px] lg:text-[64px] font-bold leading-[1.1] tracking-normal text-left flex flex-col">
            <span className="text-white">The AI-native</span>
            <span className="text-[#00d4aa]">security &amp;</span>
            <span className="text-[#00d4aa]">governance platform</span>
          </h1>

          {/* Subtext */}
          <p className="text-[17px] leading-[1.6] text-white/60 max-w-[480px] mt-6 font-sans">
            Prompt injection blocking, LLM cost control, shadow API discovery, and compliance
            reporting &mdash; all in one platform. 478 tests. 4 patents.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-10 w-full">
            <Link
              href="/register"
              className="px-7 py-3.5 bg-[#00d4aa] text-black font-semibold text-sm rounded-lg hover:opacity-90 transition-all text-center flex items-center justify-center gap-2"
            >
              Start your project &rarr;
            </Link>
            <Link
              href="/docs"
              className="px-7 py-3.5 bg-transparent border border-white/25 text-white font-semibold text-sm rounded-lg hover:bg-white/5 transition-all text-center flex items-center justify-center"
            >
              Read the docs
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: Flow Diagram */}
        <div className="w-full flex items-center justify-center relative overflow-visible py-4">
          <HeroFlowDiagram />
        </div>
      </div>
    </section>
  );
}
