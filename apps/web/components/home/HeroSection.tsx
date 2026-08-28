"use client";

import { useState } from "react";
import Link from "next/link";
import { TerminalDemo } from "./TerminalDemo";
import { LogoMarquee } from "../ui/LogoMarquee";

export function HeroSection() {
  const [copied, setCopied] = useState(false);
  const [activeLogoName, setActiveLogoName] = useState("OpenAI");

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("financial.refund({ amount: 40, orderId })");
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
          <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/30 bg-[#14B8A6]/10 px-4 py-1.5 backdrop-blur-sm w-fit mb-6">
            <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            <p className="text-xs sm:text-sm font-semibold tracking-[0.02em] text-[#14B8A6] font-sans">
              Built for secure AI teams in Bengaluru, India
            </p>
          </div>

          {/* Headline */}
          <h1 className="hero-headline font-sans font-bold tracking-[-0.02em] text-left flex flex-col text-[40px] sm:text-[48px] md:text-[56px] leading-[1.1] mb-6">
            <span className="text-white">Competitors govern the session.</span>
            <span className="text-[#14B8A6]">RaksHex governs</span>
            <span className="text-[#14B8A6]">the action.</span>
          </h1>

          {/* Subtext */}
          <p className="hero-subtext font-sans text-lg max-w-[480px] text-[#9CA3AF] mb-10 leading-[1.6] font-medium">
            Runtime authorization for autonomous AI agents. Semantic actions, delegated authority
            with parent-to-child attenuation, a hash-chained tamper-evident Action Ledger, and
            credential mediation so a DENY is enforced, not just logged.
          </p>

          {/* CTA Buttons — destination matches PR 139 (/waitlist); label is private-beta, not self-serve */}
          <div className="hero-buttons flex flex-wrap items-center gap-4 w-full mb-12">
            <Link
              href="/waitlist"
              className="px-6 py-3 bg-[#14B8A6] text-white font-sans font-semibold text-sm rounded-lg hover:bg-[#0D9488] active:bg-[#0A7F6F] hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] transition-all duration-200 text-center flex items-center justify-center gap-2 transform"
            >
              Request beta access
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 bg-transparent border-2 border-[#14B8A6] text-white font-sans font-semibold text-sm rounded-lg hover:bg-[#14B8A6]/10 hover:border-[#0D9488] active:bg-[#14B8A6]/20 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.1)] transition-all duration-200 text-center flex items-center justify-center transform"
            >
              See pricing
            </Link>
          </div>

          {/* Example semantic action */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="hero-cli-pill bg-transparent border border-[#14B8A6]/25 rounded-full px-5 py-2.5 flex items-center gap-4 w-fit">
              <span className="cli-text text-[#14B8A6] font-mono text-sm">
                $ financial.refund({"{ amount: 40, orderId }"})
              </span>
              <button
                onClick={handleCopyCommand}
                className="cli-copy-btn bg-white hover:bg-neutral-100 text-[#0a0a0a] font-sans font-bold text-xs px-4 py-1.5 rounded-full cursor-pointer transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Product claim — hash-chaining is shipped (previousHash + recordHash on action_ledger) */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-12 text-xs font-mono text-[#9CA3AF]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
              Hash-chained Action Ledger
            </span>
          </div>

          {/* Works perfectly with Label inside hero-left */}
          <div className="hero-marquee-label-container">
            <span className="marquee-label">Works perfectly with</span>
            <span className="marquee-active-name">{activeLogoName}</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Action Ledger / DENY demo */}
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
