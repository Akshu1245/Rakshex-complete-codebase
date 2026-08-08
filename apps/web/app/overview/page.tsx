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
import { ArrowRight, ShieldCheck, Sparkles, Server } from "lucide-react";

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
      <main className="pt-24 space-y-12">
        {/* Floating Sub-Nav Switcher */}
        <ComparisonSubNav onOverviewClick={() => setOverviewOpen(true)} />

        {/* Hero Section - ClickHouse Cloud Style Overview */}
        <section
          id="hero-overview"
          className="w-full max-w-7xl mx-auto px-6 pt-8 pb-16 text-center space-y-8 relative"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            RaksHex Cloud Overview
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-sans text-white max-w-4xl mx-auto leading-tight">
            Autonomous. Sub-Second. <span className="text-[#14B8A6]">Zero Retention.</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            RaksHex AI Control Plane: The fastest, most cost-efficient way to govern AI agents,
            block prompt injections, and enforce sub-second circuit breakers. Fully managed with
            zero raw prompt storage.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className="px-8 py-3.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-black font-extrabold text-sm sm:text-base transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] flex items-center gap-2"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm sm:text-base transition-all"
            >
              Book Technical Demo
            </Link>
          </div>

          {/* Cloud Provider Marketplace Badges */}
          <div className="pt-8 border-t border-slate-800/80 max-w-3xl mx-auto">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-4">
              Deployable on all major clouds &amp; hybrid environments
            </span>
            <div className="flex flex-wrap items-center justify-center gap-6 text-slate-300 text-xs font-mono">
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-amber-500" /> AWS Marketplace
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-blue-500" /> GCP Cloud
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-sky-400" /> Azure Marketplace
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-[#14B8A6] border-[#14B8A6]/30">
                <ShieldCheck className="w-3.5 h-3.5" /> BYOC / Air-Gapped
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
