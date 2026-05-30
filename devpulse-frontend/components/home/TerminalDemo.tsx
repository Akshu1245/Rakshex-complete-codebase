"use client";

import { useState, useEffect } from "react";

export function TerminalDemo() {
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
    <div className="w-full max-w-[580px] rounded-lg border border-[#14B8A6] bg-[#1A1F2E] flex flex-col md:flex-row p-5 gap-5 items-stretch shadow-md relative">
      {/* Left panel: VS Code terminal */}
      <div className="flex-1 bg-[#0a0a0a] rounded border border-[#14B8A6]/20 p-4 font-mono text-xs text-left h-52 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 mb-3 border-b border-[#1A1F2E] pb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" />
          <span className="text-[10px] text-[#9CA3AF] ml-2 font-sans font-medium">
            bash - rakshex scan
          </span>
        </div>
        <div className="space-y-2 flex-1 overflow-y-auto">
          {terminalLines.slice(0, scanStep).map((line, idx) => {
            let color = "text-[#FFFFFF]";
            if (line.startsWith("✓")) color = "text-[#14B8A6]";
            else if (line.startsWith("⚠")) color = "text-[#9CA3AF]";
            else if (line.startsWith("🔒")) color = "text-[#14B8A6]";
            else if (line.startsWith("💰")) color = "text-[#14B8A6]";
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
      </div>

      {/* Right panel: findings dashboard */}
      <div className="w-full md:w-52 bg-[#0a0a0a] rounded border border-[#14B8A6]/20 p-4 flex flex-col justify-between items-center text-center">
        <div className="w-full flex flex-col items-center gap-2">
          <span className="text-[9px] text-[#9CA3AF] uppercase tracking-widest font-sans font-semibold">
            Security Score
          </span>
          <div className="relative flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="#1A1F2E" strokeWidth="4" fill="transparent" />
              <circle
                cx="40"
                cy="40"
                r="32"
                stroke="#14B8A6"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray="201"
                strokeDashoffset={201 - (201 * securityScore) / 100}
                className="transition-all duration-750 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col justify-center items-center">
              <span className="text-xl font-extrabold font-sans text-white leading-none">
                {securityScore}
              </span>
              <span className="text-[8px] text-[#9CA3AF] font-sans font-medium mt-0.5">/100</span>
            </div>
          </div>
        </div>

        <div className="w-full mt-4 space-y-2 text-left">
          <div className="flex justify-between items-center border-b border-[#1A1F2E] pb-1.5">
            <span className="text-[9px] text-[#9CA3AF] font-sans font-medium">Issues:</span>
            <span className="text-[9px] text-white font-sans font-bold">{findings.length}</span>
          </div>
          <div className="space-y-1">
            {findings.map((f, i) => {
              let tagColor = "text-[#14B8A6] bg-[#14B8A6]/10 border-[#14B8A6]/20";
              if (f.includes("Leak")) tagColor = "text-[#9CA3AF] bg-[#1A1F2E] border-[#14B8A6]/10";
              return (
                <div
                  key={i}
                  className={`text-[8px] border rounded px-1.5 py-0.5 font-sans font-medium flex items-center gap-1 ${tagColor}`}
                >
                  {f}
                </div>
              );
            })}
            {findings.length === 0 && (
              <div className="text-[8px] text-[#9CA3AF]/60 italic font-sans">Scanning...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
