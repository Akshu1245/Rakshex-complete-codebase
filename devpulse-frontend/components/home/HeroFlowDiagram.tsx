"use client";

import { useEffect, useState } from "react";

export function HeroFlowDiagram() {
  const [scanStep, setScanStep] = useState(0);
  const [findings, setFindings] = useState<string[]>([]);
  const [securityScore, setSecurityScore] = useState(100);

  useEffect(() => {
    const steps = [
      { text: "> rakshex scan ./api.json", delay: 1200 },
      { text: "✓ 23 endpoints scanned", delay: 800 },
      { text: "⚠ 2 credentials detected", delay: 800, finding: "Credential Leak", score: 98 },
      { text: "🔒 1 prompt injection blocked", delay: 800, finding: "Prompt Injection", score: 95 },
      { text: "💰 $47.3 cost anomaly flagged", delay: 800, finding: "Cost Anomaly", score: 94 },
    ];

    let currentStep = 0;
    let timer: NodeJS.Timeout;

    const runScan = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setScanStep(currentStep + 1);
        if (step.finding) {
          setFindings((prev) => [...prev, step.finding!]);
        }
        if (step.score) {
          setSecurityScore(step.score);
        }
        currentStep++;
        timer = setTimeout(runScan, step.delay);
      } else {
        timer = setTimeout(() => {
          setFindings([]);
          setSecurityScore(100);
          currentStep = 0;
          setScanStep(0);
          runScan();
        }, 5000);
      }
    };

    runScan();
    return () => clearTimeout(timer);
  }, []);

  const terminalLines = [
    "> rakshex scan ./api.json",
    "✓ 23 endpoints scanned",
    "⚠ 2 credentials detected",
    "🔒 1 prompt injection blocked",
    "💰 $47.3 cost anomaly flagged",
  ];

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
      `}</style>

      {/* CONNECTOR LINES (Card 1 → Card 2 → Card 3) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {/* Line 1 (stepped path from Cursor (bottom center at (300, 150)) to RakshEx (top center at (155, 260))) */}
        <path
          d="M 300 150 L 300 205 L 155 205 L 155 260"
          fill="none"
          stroke="rgba(0, 212, 170, 0.3)"
          strokeWidth="2"
          strokeDasharray="6,6"
        />
        {/* Line 2 (straight line from RakshEx (right center at (295, 365)) to Security Report (left center at (335, 365))) */}
        <path
          d="M 295 365 L 335 365"
          fill="none"
          stroke="rgba(0, 212, 170, 0.3)"
          strokeWidth="2"
          strokeDasharray="6,6"
        />

        {/* Animated flowing dot for Line 1 */}
        <circle r="4" fill="#00d4aa" style={{ filter: "drop-shadow(0 0 4px #00d4aa)" }}>
          <animateMotion
            dur="3s"
            repeatCount="indefinite"
            path="M 300 150 L 300 205 L 155 205 L 155 260"
          />
        </circle>

        {/* Animated flowing dot for Line 2 */}
        <circle r="4" fill="#00d4aa" style={{ filter: "drop-shadow(0 0 4px #00d4aa)" }}>
          <animateMotion dur="2s" repeatCount="indefinite" path="M 295 365 L 335 365" />
        </circle>
      </svg>

      {/* CARD 1 — Top Center Agent Card */}
      <div className="absolute top-[20px] left-[calc(50%-140px)] z-20 w-[280px] bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 shadow-2xl animate-float-1">
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

      {/* CARD 2 — Below Left RakshEx Platform Card */}
      <div className="absolute top-[260px] left-[2.5%] z-20 w-[280px] bg-[#141414] border border-[rgba(0,212,170,0.4)] rounded-xl p-5 shadow-[0_0_20px_rgba(0,212,170,0.08)] animate-float-2">
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

      {/* CARD 3 — Below Right Result Card */}
      <div className="absolute top-[260px] right-[2.5%] z-20 w-[250px] bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 shadow-2xl animate-float-3">
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
