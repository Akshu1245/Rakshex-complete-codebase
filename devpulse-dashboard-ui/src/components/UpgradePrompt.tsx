'use client';

interface UpgradePromptProps {
  feature?: string;
  currentPlan?: string;
}

export default function UpgradePrompt({ feature = 'this feature', currentPlan = 'Free' }: UpgradePromptProps) {
  return (
    <div className="bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-violet-500/20 rounded-xl p-6 text-center">
      <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Upgrade to Pro</h3>
      <p className="text-sm text-zinc-400 mb-4 max-w-sm mx-auto">
        {feature} requires a Pro or Enterprise plan. You&apos;re currently on the <strong className="text-zinc-300">{currentPlan}</strong> plan.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href="#billing"
          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Upgrade Now — $29/mo
        </a>
        <span className="text-xs text-zinc-500">14-day free trial included</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
          Unlimited APIs
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
          Security scans
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
          Kill switch
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
          CI/CD gates
        </span>
      </div>
    </div>
  );
}
