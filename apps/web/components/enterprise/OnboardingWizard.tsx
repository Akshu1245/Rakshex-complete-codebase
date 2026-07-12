"use client";
import { useState } from "react";

interface OnboardingWizardProps {
  onComplete: () => void;
  onDismiss: () => void;
}

const steps = [
  {
    icon: "cloud",
    title: "Connect Azure",
    description:
      "Add your Azure subscription to discover API keys, service principals, and secrets across Key Vault, API Management, and more.",
    action: "Connect Azure",
  },
  {
    icon: "radar",
    title: "Run Discovery",
    description:
      "Scan all connected Azure resources to build a complete inventory of every key, secret, and credential in your estate.",
    action: "Start Discovery",
  },
  {
    icon: "analytics",
    title: "Analyze Security",
    description:
      "Detect over-privileged keys, shadow keys, and expired credentials. Get a risk score for every key in your inventory.",
    action: "Run Analysis",
  },
  {
    icon: "security",
    title: "Configure AgentGuard",
    description:
      "Set up autonomous policies that automatically revoke, rotate, or alert when high-risk keys are detected.",
    action: "Create Policy",
  },
];

export function OnboardingWizard({ onComplete, onDismiss }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="glass-card rounded-xl p-6 border border-[#14b8a6]/30 mb-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#14b8a6]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${i <= currentStep ? "bg-[#14b8a6]" : "bg-white/10"}`}
            />
          ))}
        </div>

        <div className="flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-[#14b8a6]/15 border border-[#14b8a6]/30 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[#14b8a6] text-2xl">{step.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#14b8a6] uppercase tracking-wider">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
            <p className="text-gray-400 text-sm mb-4 max-w-xl">{step.description}</p>
            <div className="flex items-center gap-3">
              {!isLast && (
                <button
                  onClick={() => setCurrentStep((s) => Math.min(s + 1, steps.length - 1))}
                  className="px-5 py-2.5 bg-[#14b8a6] hover:bg-[#0d9488] text-white text-sm font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {step.action}
                </button>
              )}
              {isLast && (
                <button
                  onClick={onComplete}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Go to Dashboard
                </button>
              )}
              <button
                onClick={onDismiss}
                className="px-4 py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
              >
                {isLast ? "Skip" : "Skip tour"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
