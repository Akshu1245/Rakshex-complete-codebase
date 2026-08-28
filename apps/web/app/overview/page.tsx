"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { ComparisonSubNav } from "@/components/home/ComparisonSubNav";
import { BuiltInCapabilities } from "@/components/home/BuiltInCapabilities";
import { ArchitectureCompareSlider } from "@/components/home/ArchitectureCompareSlider";
import { WhyMoveToRaksHex } from "@/components/home/WhyMoveToRaksHex";
import { EcosystemIntegrations } from "@/components/home/EcosystemIntegrations";
import { PerformanceCostMatrix } from "@/components/home/PerformanceCostMatrix";
import { OneOnOneMatrix } from "@/components/home/OneOnOneMatrix";
import { AskAISection } from "@/components/home/AskAISection";
import { OverviewSplash } from "@/components/home/OverviewSplash";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Sparkles } from "lucide-react";

export default function OverviewPage() {
  const [overviewOpen, setOverviewOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white font-sans selection:bg-[#14B8A6] selection:text-black relative overflow-x-hidden">
      {/* Signature Dotted Grid Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(20,184,166,0.15)_1px,transparent_0)] [background-size:24px_24px] pointer-events-none -z-10" />

      {/* First-Time Visitor Splash Overlay */}
      <OverviewSplash isOpen={overviewOpen} onClose={() => setOverviewOpen(false)} />

      {/* Header */}
      <PublicHeader />

      {/* Main Container */}
      <main className="pt-32 pb-24 space-y-12">
        {/* Floating Sub-Nav Switcher */}
        <ComparisonSubNav onOverviewClick={() => setOverviewOpen(true)} />

        {/* Hero Section — mirrors the homepage hero's positioning and structure */}
        <section
          id="hero-overview"
          className="w-full max-w-7xl mx-auto px-6 pt-8 pb-16 text-center space-y-8 relative"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            RaksHex Overview
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-[-0.03em] font-sans text-white max-w-4xl mx-auto leading-[1.05]">
            Competitors govern the session.
            <br />
            <span className="text-[#14B8A6]">RaksHex governs the action.</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Runtime authorization for autonomous AI agents. Semantic actions, delegated authority
            with parent-to-child attenuation, a hash-chained tamper-evident Action Ledger, and
            credential mediation so a DENY is enforced, not just logged.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/waitlist"
              className="px-6 py-3 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-black font-semibold text-sm sm:text-base transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] flex items-center gap-2"
            >
              <span>Request beta access</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-sm sm:text-base transition-all"
            >
              Book technical demo
            </Link>
          </div>

          {/* Product claim — matches the homepage hero */}
          <div className="pt-8 border-t border-slate-800/80 max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                Hash-chained Action Ledger
              </span>
            </div>
          </div>
        </section>

        {/* Section 1: Built-in Capabilities Vertical Tab Showcase */}
        <BuiltInCapabilities />

        {/* Section 2: Compact 16:9 Architecture Drag Slider */}
        <ArchitectureCompareSlider />

        {/* Section 3: Why Teams Move to RaksHex */}
        <WhyMoveToRaksHex />

        {/* Section 4: Powerful Ecosystem Integrations Tree */}
        <EcosystemIntegrations />

        {/* Section 5: 2x2 Performance & Cost Quadrant Chart */}
        <PerformanceCostMatrix />

        {/* Section 6: Head-to-Head 1-on-1 Competitor Matrix */}
        <OneOnOneMatrix />

        {/* Section 7: Ask AI Assistant Section */}
        <AskAISection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
