"use client";

import { useState } from "react";
import Link from "next/link";
import { HeroFlowDiagram } from "./HeroFlowDiagram";

export function HeroSection() {
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("npx rakshex scan ./collection.json");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="hero-section relative w-full bg-transparent">
      {/* LEFT COLUMN: Content */}
      <div className="hero-left text-left">
        {/* Top Badge */}
        <div className="hero-badge inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-1.5">
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
        <h1 className="hero-headline font-sans font-bold tracking-normal text-left flex flex-col">
          <span className="text-white">The AI-native</span>
          <span className="text-[#00d4aa]">security &amp;</span>
          <span className="text-[#00d4aa]">governance platform</span>
        </h1>

        {/* Subtext */}
        <p className="hero-subtext font-sans">
          Prompt injection blocking, LLM cost control, shadow API discovery, and compliance
          reporting &mdash; all in one platform. 478 tests. 4 patents.
        </p>

        {/* CTA Buttons */}
        <div className="hero-buttons flex flex-wrap items-center gap-4 w-full">
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

        {/* CLI Command Pill */}
        <div className="hero-cli-pill">
          <span className="cli-text">$ npx rakshex scan ./collection.json</span>
          <button onClick={handleCopyCommand} className="cli-copy-btn">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: Flow Diagram */}
      <div className="hero-right">
        <HeroFlowDiagram />
      </div>
    </section>
  );
}
