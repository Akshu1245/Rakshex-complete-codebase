"use client";

import { useState } from "react";
import Link from "next/link";
import { TerminalDemo } from "./TerminalDemo";
import { LogoMarquee } from "../ui/LogoMarquee";

interface HeroSectionProps {
  antiGravity: boolean;
  setAntiGravity: (active: boolean) => void;
}

export function HeroSection({ antiGravity, setAntiGravity }: HeroSectionProps) {
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
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/10 px-4 py-1.5 backdrop-blur-sm w-fit mb-6 anti-gravity-float">
            <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            <p className="text-xs sm:text-sm font-semibold tracking-[0.02em] text-[#14B8A6] font-sans">
              Backed by 4 Patents · Built in Bengaluru, India
            </p>
          </div>

          {/* Headline */}
          <h1 className="hero-headline font-sans font-bold tracking-[-0.02em] text-left flex flex-col text-[40px] sm:text-[48px] md:text-[56px] leading-[1.1] mb-6">
            <span className="text-white">Stop leaking API keys</span>
            <span className="text-[#14B8A6]">&amp; burning your</span>
            <span className="text-[#14B8A6]">AI budget</span>
          </h1>

          {/* Subtext */}
          <p className="hero-subtext font-sans text-lg max-w-[480px] text-[#9CA3AF] mb-10 leading-[1.6] font-medium">
            RaksHex scans your code and AI apps for exposed secrets, runaway LLM costs,
            prompt-injection risks, and shadow APIs &mdash; then shows you exactly how to fix them.
            First scan in 60 seconds. Free to start.
          </p>

          {/* CTA Buttons */}
          <div className="hero-buttons flex flex-wrap items-center gap-4 w-full mb-12">
            <Link
              href="/login"
              className="px-6 py-3 bg-[#14B8A6] text-white font-sans font-semibold text-sm rounded-[6px] hover:bg-[#0D9488] active:bg-[#0A7F6F] hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] transition-all duration-200 text-center flex items-center justify-center gap-2 transform"
            >
              Scan your repo free &rarr;
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 bg-transparent border-2 border-[#14B8A6] text-white font-sans font-semibold text-sm rounded-[6px] hover:bg-[#14B8A6]/10 hover:border-[#0D9488] active:bg-[#14B8A6]/20 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.1)] transition-all duration-200 text-center flex items-center justify-center transform"
            >
              See pricing
            </Link>
          </div>

          {/* CLI Command & Anti-Gravity Control */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* CLI Command Pill */}
            <div className="hero-cli-pill bg-transparent border border-[#14B8A6]/25 rounded-full px-5 py-2.5 flex items-center gap-4 w-fit">
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

            {/* Anti-Gravity Toggle Button */}
            <button
              onClick={() => setAntiGravity(!antiGravity)}
              className={`px-5 py-2.5 font-mono text-sm rounded-full border transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                antiGravity
                  ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
                  : "bg-[#14B8A6]/10 border-[#14B8A6]/30 text-[#14B8A6] hover:bg-[#14B8A6]/20 hover:border-[#14B8A6]/50 shadow-[0_0_10px_rgba(20,184,166,0.1)]"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${antiGravity ? "bg-red-500 animate-ping" : "bg-[#14B8A6]"}`}
              />
              {antiGravity ? "Deactivate Anti-Gravity" : "Activate Anti-Gravity"}
            </button>
          </div>

          {/* npm & VS Code badges */}
          <div className="flex flex-wrap items-center gap-3 mb-12">
            <a
              href="https://npmjs.com/package/rakshex"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src="https://img.shields.io/npm/dm/rakshex?style=flat-square&logo=npm&color=14B8A6&label=npm"
                alt="npm downloads"
                className="h-5"
              />
            </a>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src="https://img.shields.io/visual-studio-marketplace/i/rakshex.rakshex-vscode?style=flat-square&logo=visualstudiocode&color=14B8A6&label=vscode"
                alt="VS Code installs"
                className="h-5"
              />
            </a>
          </div>

          {/* Works perfectly with Label inside hero-left */}
          <div className="hero-marquee-label-container">
            <span className="marquee-label">Works perfectly with</span>
            <span className="marquee-active-name">{activeLogoName}</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Terminal Demo */}
        <div className="hero-right flex items-center justify-center anti-gravity-float">
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
