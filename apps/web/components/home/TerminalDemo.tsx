"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Circle } from "lucide-react";

interface TraceStep {
  label: string;
  detail: string;
}

const TRACE_STEPS: TraceStep[] = [
  { label: "Agent identified", detail: "finance-support-prod" },
  { label: "Authority checked", detail: "parent scope ≤ $50" },
  { label: "Decision reached", detail: "DENY — exceeds limit" },
  { label: "Ledger recorded", detail: "hash-chained entry" },
];

interface LedgerEntry {
  action: string;
  decision: "ALLOW" | "DENY";
}

const RECENT_LEDGER: LedgerEntry[] = [
  { action: "data.export", decision: "ALLOW" },
  { action: "infra.deploy", decision: "ALLOW" },
  { action: "financial.refund", decision: "DENY" },
];

const terminalLines = [
  "> agent.call(financial.refund, { amount: 400 })",
  "✓ authority checked: parent scope ≤ $50",
  "⛔ DENY: exceeds delegated limit",
  "🔗 written to Action Ledger",
  "🔒 credential broker: request blocked",
];

export function TerminalDemo() {
  const [scanStep, setScanStep] = useState(0);

  useEffect(() => {
    const delays = [1200, 800, 800, 800, 800];
    let currentStep = 0;
    let timer: NodeJS.Timeout;

    const runScan = () => {
      if (currentStep < terminalLines.length) {
        setScanStep(currentStep + 1);
        timer = setTimeout(runScan, delays[currentStep]);
        currentStep++;
      } else {
        timer = setTimeout(() => {
          currentStep = 0;
          setScanStep(0);
          runScan();
        }, 4500);
      }
    };

    runScan();
    return () => clearTimeout(timer);
  }, []);

  // Trace steps light up roughly in step with the terminal lines (4 trace
  // steps mapped across 5 terminal lines — the first two terminal lines
  // both belong to "authority checked").
  const traceStepIndex = Math.max(0, Math.min(TRACE_STEPS.length, scanStep - 1));
  const decided = scanStep >= 3;

  return (
    <div className="w-full max-w-[640px] rounded-lg border border-[#14B8A6] bg-transparent flex flex-col md:flex-row gap-5 p-5 items-stretch shadow-md relative">
      {/* Left panel: terminal */}
      <div className="flex-1 bg-black/40 rounded border border-[#14B8A6]/20 p-4 font-mono text-xs text-left min-h-[280px] flex flex-col">
        <div className="flex items-center gap-1.5 mb-3 border-b border-white/5 pb-2 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" />
          <span className="text-[10px] text-[#9CA3AF] ml-2 font-sans font-medium">
            bash — agent firewall
          </span>
        </div>
        <div className="space-y-2 flex-1">
          {terminalLines.slice(0, scanStep).map((line, idx) => {
            let color = "text-[#FFFFFF]";
            if (line.startsWith("✓")) color = "text-[#14B8A6]";
            else if (line.startsWith("⛔")) color = "text-red-400";
            else if (line.startsWith("🔗")) color = "text-amber-400";
            else if (line.startsWith("🔒")) color = "text-orange-400";
            return (
              <p key={idx} className={`${color} font-mono leading-relaxed`}>
                {line}
              </p>
            );
          })}
          {scanStep < terminalLines.length && (
            <span className="inline-block w-1.5 h-3 bg-[#14B8A6] ml-1 animate-pulse" />
          )}
        </div>

        {/* Recent Action Ledger entries — fills the lower terminal space
            with something informative instead of blank space, and
            reinforces the ledger concept beyond this one demo action. */}
        <div className="mt-4 pt-3 border-t border-white/5 shrink-0">
          <span className="text-[9px] text-[#9CA3AF] uppercase tracking-widest font-sans font-semibold block mb-2">
            Recent Action Ledger
          </span>
          <div className="space-y-1.5">
            {RECENT_LEDGER.map((entry, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-[#9CA3AF] font-mono truncate">{entry.action}</span>
                <span
                  className={`font-mono font-semibold shrink-0 ${entry.decision === "ALLOW" ? "text-[#14B8A6]" : "text-red-400"}`}
                >
                  {entry.decision}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: live decision trace */}
      <div className="w-full md:w-64 bg-black/40 rounded border border-[#14B8A6]/20 p-4 flex flex-col shrink-0">
        <span className="text-[9px] text-[#9CA3AF] uppercase tracking-widest font-sans font-semibold mb-3">
          Live Decision
        </span>

        <div className="flex-1 space-y-0">
          {TRACE_STEPS.map((step, i) => {
            const isDone = i < traceStepIndex;
            const isCurrent = i === traceStepIndex && scanStep > 0 && scanStep < 5;
            const isDenyStep = i === 2;
            return (
              <div key={i} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  {isDone ? (
                    isDenyStep ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />
                    )
                  ) : (
                    <Circle
                      className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-[#14B8A6] animate-pulse" : "text-white/15"}`}
                    />
                  )}
                  {i < TRACE_STEPS.length - 1 && (
                    <span
                      className={`w-px flex-1 min-h-[14px] ${isDone ? "bg-[#14B8A6]/30" : "bg-white/10"}`}
                    />
                  )}
                </div>
                <div className="pb-3">
                  <p
                    className={`text-[10px] font-sans font-semibold ${isDone || isCurrent ? "text-white" : "text-white/30"}`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`text-[9px] font-mono mt-0.5 ${isDone ? (isDenyStep ? "text-red-400" : "text-[#9CA3AF]") : "text-white/20"}`}
                  >
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`mt-2 rounded px-2.5 py-2 text-center border transition-colors duration-500 ${
            decided
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-white/10 bg-white/[0.02] text-white/30"
          }`}
        >
          <span className="text-[10px] font-mono font-bold tracking-wider">
            {decided ? "DENY" : "EVALUATING…"}
          </span>
        </div>
      </div>
    </div>
  );
}
