'use client';

import { useState } from 'react';

const ONBOARDING_STEPS = [
  { id: 'add_api', title: 'Add your first API', description: 'Monitor an API endpoint for health, latency, and cost', icon: '🔗' },
  { id: 'set_budget', title: 'Set a budget alert', description: 'Get notified before API costs exceed your limits', icon: '💰' },
  { id: 'run_scan', title: 'Run a security scan', description: 'Check your API for vulnerabilities and misconfigurations', icon: '🔒' },
  { id: 'invite_team', title: 'Invite a teammate', description: 'Collaborate with your team on API management', icon: '👥' },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
}

export default function OnboardingModal({ isOpen, onClose, username = 'there' }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  if (!isOpen) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const progress = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const allDone = completedSteps.length === ONBOARDING_STEPS.length;

  const handleComplete = () => {
    if (step && !completedSteps.includes(step.id)) {
      setCompletedSteps(prev => [...prev, step.id]);
    }
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {allDone ? '🎉 All Set!' : `Welcome, ${username}!`}
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                {allDone
                  ? 'You\u0027re ready to use DevPulse Pro'
                  : `Step ${currentStep + 1} of ${ONBOARDING_STEPS.length} — Let\u0027s get you set up`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        {!allDone && step && (
          <div className="p-6">
            <div className="text-center py-8">
              <span className="text-5xl mb-4 block">{step.icon}</span>
              <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto">{step.description}</p>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-2 mb-6">
              {ONBOARDING_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === currentStep
                      ? 'bg-violet-500 scale-125'
                      : completedSteps.includes(s.id)
                        ? 'bg-emerald-500'
                        : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 border-t border-zinc-800 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {allDone ? 'Close' : 'Skip'}
          </button>
          {!allDone && (
            <button
              onClick={handleComplete}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isLastStep ? 'Finish Setup' : 'Mark Done & Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
