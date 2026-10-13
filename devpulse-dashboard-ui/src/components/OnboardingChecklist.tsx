'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';

interface Step {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  action?: string;
}

export default function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[]>(() => {
    const defaults: Step[] = [
      { id: 'scan', label: 'Run your first security scan', description: 'Paste code into the AI Security Scanner', completed: false, action: 'security' },
      { id: 'costs', label: 'View cost dashboard', description: 'See your API spending breakdown', completed: false, action: 'costs' },
      { id: 'budget', label: 'Set a budget alert', description: 'Create a spending limit to avoid surprise bills', completed: false, action: 'budget' },
      { id: 'apikey', label: 'Add an API key', description: 'Connect your first AI provider', completed: false, action: 'keys' },
      { id: 'vscode', label: 'Install VS Code extension', description: 'Get inline security scanning in your editor', completed: false, action: 'vscode' },
    ];
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = localStorage.getItem('onboarding_steps');
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return defaults;
      return defaults.map((step) => ({
        ...step,
        completed: parsed.includes(step.id),
      }));
    } catch {
      return defaults;
    }
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('onboarding_dismissed') === 'true';
  });

  const completeStep = (id: string) => {
    setSteps((prev) => {
      const updated = prev.map(s => s.id === id ? { ...s, completed: true } : s);
      const completedIds = updated.filter(s => s.completed).map(s => s.id);
      localStorage.setItem('onboarding_steps', JSON.stringify(completedIds));
      return updated;
    });
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  if (dismissed || completedCount === steps.length) return null;

  return (
    <Card className="bg-gradient-to-br from-violet-500/8 via-zinc-900/50 to-emerald-500/8 border-violet-500/15">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight">Get Started with DevPulse</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{completedCount} of {steps.length} steps completed</p>
          </div>
        </div>
        <IconButton
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('onboarding_dismissed', 'true');
          }}
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-zinc-800/80 rounded-full h-1.5 mb-5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-violet-500 to-emerald-500 h-1.5 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/40 rounded-xl px-4 py-3 transition-all duration-200 ${
              step.completed ? 'opacity-50' : 'hover:bg-zinc-800/40 hover:border-zinc-700/40 cursor-pointer'
            }`}
            onClick={() => !step.completed && completeStep(step.id)}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
              step.completed ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 group-hover:border-zinc-500'
            }`}>
              {step.completed && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-medium ${step.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {step.label}
              </h4>
              <p className="text-[11px] text-zinc-600 truncate">{step.description}</p>
            </div>
            {!step.completed && (
              <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
