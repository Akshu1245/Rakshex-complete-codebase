"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, XCircle } from "lucide-react";

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

const TERMINAL_LINES = [
  "> agent.call(financial.refund, { amount: 400 })",
  "✓ authority checked: parent scope ≤ $50",
  "⛔ DENY: exceeds delegated limit",
  "🔗 written to Action Ledger",
  "🔒 credential broker: request blocked",
];

export function TerminalDemo() {
  const [scanStep, setScanStep] = useState(0);

  useEffect(() => {
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setScanStep(TERMINAL_LINES.length);
      return;
    }

    const delays = [1100, 750, 750, 750, 750];
    let currentStep = 0;
    let timer: ReturnType<typeof setTimeout>;

    const run = () => {
      if (currentStep < TERMINAL_LINES.length) {
        setScanStep(currentStep + 1);
        timer = setTimeout(run, delays[currentStep]);
        currentStep += 1;
        return;
      }

      timer = setTimeout(() => {
        currentStep = 0;
        setScanStep(0);
        run();
      }, 4200);
    };

    run();
    return () => clearTimeout(timer);
  }, []);

  const traceStepIndex = Math.max(0, Math.min(TRACE_STEPS.length, scanStep - 1));
  const decided = scanStep >= 3;

  return (
    <div className="relative flex w-full max-w-[640px] flex-col gap-4 rounded-xl border border-[#14B8A6]/45 bg-[#070A0F]/85 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-5 md:flex-row md:gap-5">
      <div className="flex min-h-[245px] min-w-0 flex-1 flex-col rounded-lg border border-white/[0.08] bg-black/35 p-4 text-left font-mono text-xs">
        <span className="mb-3 font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8B939F]">
          Decision trace
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          {TERMINAL_LINES.slice(0, scanStep).map((line) => {
            let color = "text-white";
            if (line.startsWith("✓")) color = "text-[#14B8A6]";
            else if (line.startsWith("⛔")) color = "text-red-400";
            else if (line.startsWith("🔗")) color = "text-amber-300";
            else if (line.startsWith("🔒")) color = "text-orange-300";

            return (
              <p key={line} className={`break-words font-mono leading-relaxed ${color}`}>
                {line}
              </p>
            );
          })}
          {scanStep < TERMINAL_LINES.length && (
            <span className="ml-1 inline-block h-3 w-1.5 bg-[#14B8A6] motion-safe:animate-pulse" />
          )}
        </div>

        <div className="mt-4 shrink-0 border-t border-white/[0.06] pt-3">
          <span className="mb-2 block font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8B939F]">
            Recent Action Ledger
          </span>
          <div className="space-y-1.5">
            {RECENT_LEDGER.map((entry) => (
              <div key={entry.action} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="min-w-0 flex-1 truncate font-mono text-[#9CA3AF]">{entry.action}</span>
                <span
                  className={`shrink-0 font-mono font-semibold ${
                    entry.decision === "ALLOW" ? "text-[#14B8A6]" : "text-red-400"
                  }`}
                >
                  {entry.decision}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col rounded-lg border border-white/[0.08] bg-black/35 p-4 md:w-64">
        <span className="mb-3 font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8B939F]">
          Live decision
        </span>

        <div className="flex-1 space-y-0">
          {TRACE_STEPS.map((step, index) => {
            const isDone = index < traceStepIndex;
            const isCurrent = index === traceStepIndex && scanStep > 0 && scanStep < 5;
            const isDenyStep = index === 2;

            return (
              <div key={step.label} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  {isDone ? (
                    isDenyStep ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#14B8A6]" aria-hidden="true" />
                    )
                  ) : (
                    <Circle
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isCurrent ? "text-[#14B8A6] motion-safe:animate-pulse" : "text-white/15"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  {index < TRACE_STEPS.length - 1 && (
                    <span
                      className={`min-h-[14px] w-px flex-1 ${
                        isDone ? "bg-[#14B8A6]/30" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-3">
                  <p
                    className={`font-sans text-[10px] font-semibold ${
                      isDone || isCurrent ? "text-white" : "text-white/30"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p
                    className={`mt-0.5 font-mono text-[9px] ${
                      isDone ? (isDenyStep ? "text-red-400" : "text-[#9CA3AF]") : "text-white/20"
                    }`}
                  >
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`mt-2 rounded-md border px-2.5 py-2 text-center ${
            decided
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-white/10 bg-white/[0.02] text-white/30"
          }`}
          aria-live="polite"
        >
          <span className="font-mono text-[10px] font-bold tracking-wider">
            {decided ? "DENY · CREDENTIAL NOT RELEASED" : "EVALUATING…"}
          </span>
        </div>
      </div>
    </div>
  );
}
