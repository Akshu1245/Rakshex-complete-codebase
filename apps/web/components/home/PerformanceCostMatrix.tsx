"use client";

import React from "react";
import { Zap, DollarSign, TrendingDown, ArrowUpRight, ShieldCheck, Activity } from "lucide-react";

export function PerformanceCostMatrix() {
  return (
    <section className="w-full py-20 px-4 md:px-8 bg-[#080C14] relative overflow-hidden border-t border-slate-800/80">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#14B8A6]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold uppercase tracking-wider font-mono">
            <Activity className="w-3.5 h-3.5" />
            Coverage vs Enforcement
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-sans">
            Visibility Isn&apos;t Control. <span className="text-[#14B8A6]">Enforcement Is.</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Where RaksHex sits relative to logging, alerting, and session-scoped approaches teams
            already run today.
          </p>
        </div>

        {/* 2x2 Matrix Container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Axis Labels */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-3 px-2">
            <span className="flex items-center gap-1.5 text-slate-300">
              <DollarSign className="w-4 h-4 text-[#14B8A6]" /> Blast Radius (Narrow vs Broad)
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-4 h-4 text-[#14B8A6]" /> Decision Granularity →
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* QUADRANT 1 (Top-Left): Coarse & Narrow */}
            <div className="bg-[#0B0F18] border border-slate-800/80 rounded-2xl p-6 min-h-[220px] flex flex-col justify-between relative group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Coarse &amp; Manual
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Manual Review
                </span>
              </div>
              <div className="space-y-2 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  Human-in-the-loop approval queues
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  Periodic access reviews
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Slow • Doesn&apos;t scale with agent volume
              </span>
            </div>

            {/* QUADRANT 2 (Top-Right): Fine-grained & Narrow (RAKSHEX) */}
            <div className="bg-[#081219] border-2 border-[#14B8A6] rounded-2xl p-6 min-h-[240px] flex flex-col justify-between relative shadow-[0_0_30px_rgba(20,184,166,0.15)] group hover:shadow-[0_0_40px_rgba(20,184,166,0.25)] transition-all overflow-hidden">
              {/* Corner Badge */}
              <div className="absolute top-0 right-0 bg-[#14B8A6] text-black font-mono text-[10px] font-bold uppercase px-3 py-1 rounded-bl-xl tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> RaksHex
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-[#14B8A6] uppercase tracking-wider block">
                  Fine-Grained &amp; Automated
                </span>
                <h3 className="text-2xl font-extrabold text-white mt-2 font-sans flex items-center gap-2">
                  Agent Firewall
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14B8A6] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#14B8A6]"></span>
                  </span>
                </h3>
                <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
                  Each semantic action is authorized against attenuated authority in real time — no
                  queue, no broad session grant.
                </p>
              </div>

              <div className="pt-4 border-t border-[#14B8A6]/20 flex items-center justify-between text-xs font-mono text-[#14B8A6]">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" /> Narrow blast radius
                </span>
                <span className="flex items-center gap-1 font-bold">
                  Enforced, not advisory <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* QUADRANT 3 (Bottom-Left): Coarse & Broad */}
            <div className="bg-[#0B0F18] border border-slate-800/80 rounded-2xl p-6 min-h-[220px] flex flex-col justify-between relative group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Coarse &amp; Broad
                </span>
                <span className="text-[10px] font-mono text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-500/20">
                  Static API Keys
                </span>
              </div>
              <div className="space-y-2 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  One key, every action it can technically reach
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  Rotation is the only real control lever
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  No per-action authorization
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Highest exposure if a credential leaks
              </span>
            </div>

            {/* QUADRANT 4 (Bottom-Right): Fine-grained but logging-only */}
            <div className="bg-[#0B0F18] border border-slate-800/80 rounded-2xl p-6 min-h-[220px] flex flex-col justify-between relative group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  Fine-Grained but Broad
                </span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                  Logging / Observability
                </span>
              </div>
              <div className="space-y-2 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  Detailed traces of what happened, after the fact
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  Alerting, not blocking
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Good visibility • No enforcement lever
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
