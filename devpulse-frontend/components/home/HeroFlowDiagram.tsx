"use client";

import { useEffect, useState } from "react";

export function HeroFlowDiagram() {
  return (
    <div className="relative w-full max-w-[600px] h-[520px] flex flex-col items-center justify-between select-none">
      {/* Floating animations definitions */}
      <style jsx global>{`
        @keyframes float-c1 {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes float-c2 {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes float-c3 {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        .animate-float-1 {
          animation: float-c1 4s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: float-c2 4s ease-in-out infinite 0.5s;
        }
        .animate-float-3 {
          animation: float-c3 4s ease-in-out infinite 1s;
        }

        @keyframes flow-down {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes flow-right {
          0% {
            left: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            left: 100%;
            opacity: 0;
          }
        }

        .animate-flow-down {
          animation: flow-down 2s linear infinite;
        }
        .animate-flow-right {
          animation: flow-right 2s linear infinite;
        }
      `}</style>

      {/* CARD 1 — Top Left Agent Card */}
      <div className="absolute top-[20px] left-[5%] z-20 w-[280px] bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 shadow-2xl animate-float-1">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 flex items-center justify-center text-white">
            {/* Cursor Logo */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M4.26402 7.99939L11.74 11.8359C11.904 11.9324 12.005 12.1084 12.005 12.2989L11.9995 20.4759C11.9995 21.0284 12.733 21.2209 13.004 20.7394L20.001 7.78389C20.2025 7.42589 19.9435 6.98389 19.533 6.98389L4.53552 6.99989C3.98852 6.99989 3.79252 7.72239 4.26402 7.99939Z" />
            </svg>
          </div>
          <span className="font-sans font-semibold text-sm text-white">Cursor</span>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-[rgba(0,212,170,0.15)] border border-[rgba(0,212,170,0.3)] rounded-full px-2.5 py-1 mb-3">
          <span className="text-[#00d4aa] text-[10px] animate-pulse">●</span>
          <span className="text-[#00d4aa] text-[11px] font-medium font-sans">
            RakshEx Connected
          </span>
        </div>
        <p className="text-neutral-400 font-sans text-xs leading-normal">
          Scan my FastAPI app for security vulnerabilities and cost anomalies.
        </p>
      </div>

      {/* CONNECTOR LINE (Card 1 → Card 2) */}
      <div className="absolute top-[170px] left-[25%] w-[2px] h-[100px] border-l-2 border-dashed border-[rgba(0,212,170,0.3)] z-10">
        {/* Animated flowing dot */}
        <div className="absolute left-[-3.5px] w-2.5 h-2.5 rounded-full bg-[#00d4aa] shadow-[0_0_8px_#00d4aa] animate-flow-down" />
      </div>

      {/* CARD 2 — Center RakshEx Platform Card */}
      <div className="absolute top-[260px] left-[5%] z-20 w-[300px] bg-[#141414] border border-[rgba(0,212,170,0.4)] rounded-xl p-5 shadow-[0_0_20px_rgba(0,212,170,0.08)] animate-float-2">
        <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
          <div className="w-5 h-5 flex items-center justify-center text-[#00d4aa]">
            {/* Shield Icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="font-sans font-bold text-sm text-white">RakshEx</span>
        </div>

        <div className="flex flex-col">
          {/* Row 1 */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="text-neutral-400 text-xs">🔒</span>
              <span className="font-sans text-xs text-neutral-300">Endpoints Scanned</span>
            </div>
            <span className="font-mono text-xs font-semibold text-[#00d4aa]">23</span>
          </div>

          {/* Row 2 */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="text-neutral-400 text-xs">⚠️</span>
              <span className="font-sans text-xs text-neutral-300">Credentials Detected</span>
            </div>
            <span className="font-mono text-xs font-semibold text-amber-400">2</span>
          </div>

          {/* Row 3 */}
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="text-neutral-400 text-xs">💰</span>
              <span className="font-sans text-xs text-neutral-300">Cost Anomaly Flagged</span>
            </div>
            <span className="font-mono text-xs font-semibold text-red-400">$47.3</span>
          </div>

          {/* Row 4 */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <span className="text-neutral-400 text-xs">🛡️</span>
              <span className="font-sans text-xs text-neutral-300">Prompt Injection Blocked</span>
            </div>
            <span className="font-mono text-xs font-semibold text-[#00d4aa]">1</span>
          </div>
        </div>
      </div>

      {/* CONNECTOR LINE (Card 2 → Card 3) */}
      <div className="absolute top-[345px] left-[320px] w-[90px] h-[2px] border-t-2 border-dashed border-[rgba(0,212,170,0.3)] z-10">
        {/* Animated flowing dot */}
        <div className="absolute top-[-3.5px] w-2.5 h-2.5 rounded-full bg-[#00d4aa] shadow-[0_0_8px_#00d4aa] animate-flow-right" />
      </div>

      {/* CARD 3 — Right Result Card */}
      <div className="absolute top-[280px] right-[5%] z-20 w-[220px] bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 shadow-2xl animate-float-3">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
          <div className="w-4 h-4 flex items-center justify-center text-neutral-400">
            {/* Monitor Icon */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <span className="font-sans font-semibold text-xs text-neutral-200">Security Report</span>
        </div>

        {/* Skeleton dashboard */}
        <div className="space-y-3 mb-3">
          <div className="space-y-1.5">
            <div className="h-1.5 w-full bg-neutral-800 rounded-full" />
            <div className="h-1.5 w-[75%] bg-neutral-800 rounded-full" />
            <div className="h-1.5 w-[45%] bg-neutral-800 rounded-full" />
          </div>

          {/* Rectangular vertical chart */}
          <div className="h-12 w-full bg-neutral-900 rounded-md border border-neutral-800 flex items-end justify-around p-1 gap-1.5">
            <div className="w-3 h-[85%] bg-[#00d4aa] rounded-sm" />
            <div className="w-3 h-[45%] bg-amber-400 rounded-sm" />
            <div className="w-3 h-[20%] bg-red-500 rounded-sm" />
          </div>
        </div>

        {/* Score Badge */}
        <div className="text-center bg-white/[0.02] border border-white/5 rounded-lg py-2">
          <p className="text-[10px] text-neutral-500 font-sans uppercase tracking-wider font-semibold">
            Security Score
          </p>
          <span className="text-sm font-mono font-bold text-[#00d4aa]">94/100</span>
        </div>
      </div>
    </div>
  );
}
