"use client";

import { useState } from "react";
import Link from "next/link";
import { TerminalDemo } from "./TerminalDemo";
import { LogoMarquee } from "../ui/LogoMarquee";

export function HeroSection() {
  const [copied, setCopied] = useState(false);
  const [activeLogoName, setActiveLogoName] = useState("OpenAI");

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("npx rakshex scan ./collection.json");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="hero-section relative w-full bg-transparent overflow-hidden">
      {/* Subtle professional radial glow behind contents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(20,184,166,0.08),transparent_70%)] pointer-events-none z-0" />

      <div className="hero-grid relative z-10">
        {/* LEFT COLUMN: Content */}
        <div className="hero-left text-left">
          {/* Headline */}
          <h1 className="hero-headline font-sans font-bold tracking-[-0.02em] text-left flex flex-col text-[40px] sm:text-[48px] md:text-[56px] leading-[1.1] mb-6">
            <span className="text-white">The AI-native</span>
            <span className="text-[#14B8A6]">security &amp;</span>
            <span className="text-[#14B8A6]">governance platform</span>
          </h1>

          {/* Subtext */}
          <p className="hero-subtext font-sans text-lg max-w-[480px] text-[#9CA3AF] mb-10 leading-[1.6] font-medium">
            Prompt injection blocking, LLM cost control, shadow API discovery, and compliance
            reporting &mdash; all in one platform. 478 tests.
          </p>

          {/* CTA Buttons */}
          <div className="hero-buttons flex flex-wrap items-center gap-4 w-full mb-12">
            <Link
              href="/register"
              className="px-6 py-3 bg-[#14B8A6] text-white font-sans font-semibold text-sm rounded-[6px] hover:bg-[#0D9488] active:bg-[#0A7F6F] hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] transition-all duration-200 text-center flex items-center justify-center gap-2 transform"
            >
              Start your project &rarr;
            </Link>
            <Link
              href="/docs"
              className="px-6 py-3 bg-transparent border-2 border-[#14B8A6] text-white font-sans font-semibold text-sm rounded-[6px] hover:bg-[#14B8A6]/10 hover:border-[#0D9488] active:bg-[#14B8A6]/20 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.1)] transition-all duration-200 text-center flex items-center justify-center transform"
            >
              Read the docs
            </Link>
          </div>

          {/* CLI Command Pill */}
          <div className="hero-cli-pill bg-[#1A1F2E] border border-[#14B8A6]/25 rounded-full px-5 py-2.5 flex items-center gap-4 w-fit mb-12">
            <span className="cli-text text-[#14B8A6] font-mono text-sm">
              $ npx rakshex scan ./collection.json
            </span>
            <button
              onClick={handleCopyCommand}
              className="cli-copy-btn bg-white hover:bg-neutral-100 text-[#0a0a0a] font-sans font-bold text-xs px-4 py-1.5 rounded-full cursor-pointer transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Works perfectly with Label inside hero-left */}
          <div className="hero-marquee-label-container">
            <span className="marquee-label">Works perfectly with</span>
            <span className="marquee-active-name">{activeLogoName}</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Terminal Demo */}
        <div className="hero-right flex items-center justify-center">
          <TerminalDemo />
        </div>
      </div>

      {/* Full width scrolling marquee below the two-column grid */}
      <div className="marquee-full-width">
        <LogoMarquee hideHeader={true} onActiveNameChange={setActiveLogoName} />
      </div>
    </section>
  );
}
