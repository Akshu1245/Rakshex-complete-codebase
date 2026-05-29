"use client";

import { useState } from "react";
import Link from "next/link";
import { HeroFlowDiagram } from "./HeroFlowDiagram";
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
    <section className="hero-section relative w-full bg-transparent">
      <div className="hero-grid">
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
          <h1 className="hero-headline font-sans font-extrabold tracking-[-0.02em] text-left flex flex-col text-5xl md:text-[72px] leading-[1.1] mb-6">
            <span className="text-white">The AI-native</span>
            <span className="text-teal-accent">security &amp;</span>
            <span className="text-teal-accent">governance platform</span>
          </h1>

          {/* Subtext */}
          <p className="hero-subtext font-sans text-lg max-w-[800px] text-slate-400 mb-10 leading-[1.6]">
            Prompt injection blocking, LLM cost control, shadow API discovery, and compliance
            reporting &mdash; all in one platform. 478 tests. 4 patents.
          </p>

          {/* CTA Buttons */}
          <div className="hero-buttons flex flex-wrap items-center gap-4 w-full mb-12">
            <Link
              href="/register"
              className="px-7 py-3.5 bg-gradient-to-r from-teal-accent to-electric-cyan text-[#0A0E1A] font-bold text-sm rounded-lg hover:shadow-[0_0_20px_rgba(6,214,160,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-center flex items-center justify-center gap-2 transform"
            >
              Start your project &rarr;
            </Link>
            <Link
              href="/docs"
              className="px-7 py-3.5 bg-transparent border-2 border-teal-accent text-teal-accent font-semibold text-sm rounded-lg hover:bg-teal-accent/10 hover:text-electric-cyan hover:border-electric-cyan transition-all duration-200 text-center flex items-center justify-center"
            >
              Read the docs
            </Link>
          </div>

          {/* CLI Command Pill */}
          <div className="hero-cli-pill bg-[#0F1419] border border-[#2D3E50]">
            <span className="cli-text text-emerald-400">$ npx rakshex scan ./collection.json</span>
            <button
              onClick={handleCopyCommand}
              className="cli-copy-btn text-teal-accent hover:text-electric-cyan font-semibold transition-colors"
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

        {/* RIGHT COLUMN: Flow Diagram */}
        <div className="hero-right">
          <HeroFlowDiagram />
        </div>
      </div>

      {/* Full width scrolling marquee below the two-column grid */}
      <div className="marquee-full-width">
        <LogoMarquee hideHeader={true} onActiveNameChange={setActiveLogoName} />
      </div>
    </section>
  );
}
