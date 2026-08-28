"use client";

import React, { useState, useEffect } from "react";
import { Shield, Zap, Lock, BarChart2, ArrowRight, X, Sparkles } from "lucide-react";
import { RaksHexLogo } from "@/components/common/RaksHexLogo";

interface OverviewSplashProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function OverviewSplash({ isOpen: externalIsOpen, onClose }: OverviewSplashProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // An explicit "open" request (e.g. clicking "Cloud Overview" in the
    // sub-nav) always shows it, regardless of first-visit state.
    if (externalIsOpen === true) {
      setIsOpen(true);
      return;
    }

    // Otherwise (externalIsOpen is false or undefined — both real call
    // sites pass a default-false state on mount), fall through to the
    // first-time-visitor check. Previously this branch was unreachable
    // whenever a parent passed any defined boolean, which silently
    // disabled the auto-show-on-first-visit behavior entirely.
    const hasSeenOverview = localStorage.getItem("rakshex_overview_seen");
    if (!hasSeenOverview) {
      setIsOpen(true);
    }
  }, [externalIsOpen]);

  const handleClose = () => {
    localStorage.setItem("rakshex_overview_seen", "true");
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0B0F17] border border-[#14B8A6]/40 rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(20,184,166,0.25)] overflow-hidden space-y-8">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-[#14B8A6]/10 blur-[100px] rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
          aria-label="Close Overview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            Platform Executive Summary
          </div>
          <div className="flex items-center gap-3">
            <RaksHexLogo size={36} />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Runtime Authorization <span className="text-[#14B8A6]">for AI Agents</span>
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            RaksHex gives engineering, security, and finance teams semantic action authorization,
            delegated authority with attenuation, and a tamper-evident audit trail — enforced at the
            credential, not just logged.
          </p>
        </div>

        {/* 4 Key Platform Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#0D131F] border border-[#14B8A6]/20 rounded-2xl p-4 space-y-2 hover:border-[#14B8A6]/50 transition-colors">
            <div className="flex items-center gap-2 text-[#14B8A6] font-bold text-sm font-sans">
              <Shield className="w-4 h-4" /> Semantic Action Authorization
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Actions like financial.refund are evaluated against the caller's actual delegated
              authority before they execute.
            </p>
          </div>

          <div className="bg-[#0D131F] border border-[#14B8A6]/20 rounded-2xl p-4 space-y-2 hover:border-[#14B8A6]/50 transition-colors">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm font-sans">
              <Zap className="w-4 h-4" /> Fail-Closed Credential Broker
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              A DENY blocks the credential itself, so a denied action can't fall back to a raw API
              key that still works.
            </p>
          </div>

          <div className="bg-[#0D131F] border border-[#14B8A6]/20 rounded-2xl p-4 space-y-2 hover:border-[#14B8A6]/50 transition-colors">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm font-sans">
              <BarChart2 className="w-4 h-4" /> Delegated Authority
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Parent-to-child attenuation is enforced in code — a child authority can never be
              broader than its parent.
            </p>
          </div>

          <div className="bg-[#0D131F] border border-[#14B8A6]/20 rounded-2xl p-4 space-y-2 hover:border-[#14B8A6]/50 transition-colors">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-sans">
              <Lock className="w-4 h-4" /> Hash-Chained Action Ledger
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Every authorization decision is written to a tamper-evident ledger for audit and
              dispute resolution.
            </p>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:bg-[#0D9488] text-black font-bold text-xs sm:text-sm font-sans transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Explore Platform</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
