"use client";

import React, { useState } from "react";
import { Sliders, Shield, Zap, RefreshCw, Plus, Minus, Lock, Cpu, BarChart2 } from "lucide-react";

interface AccordionItem {
  title: string;
  detail: string;
  icon: React.ReactNode;
}

const ACCORDIONS: AccordionItem[] = [
  {
    title: "Deny at the credential, not just the log line",
    detail:
      "The credential broker mediates every brokered request. A DENY blocks the secret from ever reaching the caller — enforcement lives at the same layer as the credential, not in a dashboard someone has to watch.",
    icon: <Cpu className="w-5 h-5 text-[#14B8A6]" />,
  },
  {
    title: "Authority that narrows as it delegates",
    detail:
      "Parent-to-child attenuation means a delegated authority can only be equal to or narrower than its parent's scope — never broader. That asymmetry is enforced in code, not policy convention.",
    icon: <Lock className="w-5 h-5 text-[#14B8A6]" />,
  },
  {
    title: "A ledger built for disputes, not just dashboards",
    detail:
      "Every authorization decision is written to a hash-chained Action Ledger. When something goes wrong, you get a tamper-evident record of exactly what was allowed, by whom, and under what authority.",
    icon: <Shield className="w-5 h-5 text-[#14B8A6]" />,
  },
  {
    title: "Semantic actions, not raw API calls",
    detail:
      "Policies are written against actions like financial.refund, not against HTTP verbs and paths. That means the rule reads the way a human would reason about the risk.",
    icon: <BarChart2 className="w-5 h-5 text-[#14B8A6]" />,
  },
];

export function WhyMoveToRaksHex() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="w-full py-20 px-4 md:px-8 bg-[#090D14] relative border-t border-slate-800/80">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-sans">
            Why Teams Move Past Session-Level Auth To{" "}
            <span className="text-[#14B8A6]">RaksHex</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            A valid API key or session token proves who is calling — not whether this specific
            action, right now, should be allowed.
          </p>
        </div>

        {/* Top 3 Highlight Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0D121C] border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-[#14B8A6]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-base font-sans">
              Govern the action, not the session
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Every semantic action is evaluated against the caller's actual delegated authority,
              not just whether the session is valid.
            </p>
          </div>

          <div className="bg-[#0D121C] border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-[#14B8A6]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-base font-sans">
              A DENY that actually denies
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Enforcement happens at the credential broker, so a blocked action can't fall back to a
              raw API key that still works.
            </p>
          </div>

          <div className="bg-[#0D121C] border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-[#14B8A6]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6]">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-base font-sans">
              Evidence you can hand to an auditor
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              The hash-chained Action Ledger gives you a tamper-evident record of every
              authorization decision, not a log you have to trust.
            </p>
          </div>
        </div>

        {/* Interactive Expandable Accordion Suite */}
        <div className="space-y-3 max-w-4xl mx-auto pt-4">
          {ACCORDIONS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-[#0B0F17] border border-slate-800/80 rounded-xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 flex items-center justify-between text-left text-white font-semibold text-sm md:text-base font-sans hover:text-[#14B8A6] transition-colors gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  {isOpen ? (
                    <Minus className="w-5 h-5 text-[#14B8A6] shrink-0" />
                  ) : (
                    <Plus className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-slate-300 text-xs md:text-sm leading-relaxed border-t border-slate-800/50">
                    <p>{item.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
