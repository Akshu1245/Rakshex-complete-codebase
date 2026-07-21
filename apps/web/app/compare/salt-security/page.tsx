"use client";

import Link from "next/link";

export default function CompareSaltSecurity() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-blue-400 mb-6">
          <Link href="/compare" className="hover:underline">
            ← All Comparisons
          </Link>
        </nav>

        <header className="mb-12">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-900/40 uppercase tracking-wider mb-3">
            Head-to-Head
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
            DevPulse vs Salt Security
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-3xl">
            Salt Security pioneered ML-based API anomaly detection and posture management. DevPulse
            is a modern AI-native runtime governance platform focused on prompt security, LLM cost
            control, agentic workflows, and deep GitHub-native scanning.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h2 className="font-bold text-xl mb-4 text-emerald-400">DevPulse</h2>
            <ul className="space-y-2 text-sm">
              <li>✅ Real-time PR secret + heuristic scanning with rich GitHub comments</li>
              <li>
                ✅ LLM-specific: prompt injection firewall, thinking token telemetry, cost
                attribution
              </li>
              <li>✅ AgentGuard kill-switch and runtime policy blocks for risky tool calls</li>
              <li>✅ GitHub App + VS Code deep integration</li>
              <li>✅ OWASP AI Top 10 + custom policy engine</li>
              <li>✅ Fast iteration, developer-first UX</li>
            </ul>
            <div className="mt-4 text-xs text-emerald-400">
              Best for: AI-first engineering teams shipping with LLMs + GitHub Copilot.
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h2 className="font-bold text-xl mb-4">Salt Security</h2>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Strong traditional API discovery and anomaly detection</li>
              <li>Mature posture management and ML baselines for REST/GraphQL</li>
              <li>Good for large-scale API inventory</li>
              <li>Limited native support for prompt semantics or LLM spend</li>
              <li>Less emphasis on developer workflow (PRs, IDE, agents)</li>
            </ul>
            <div className="mt-4 text-xs">
              Best for: Enterprises focused purely on classic API security posture at massive scale.
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Start with DevPulse
          </Link>
          <p className="text-xs mt-3 text-slate-500">
            Free tier includes GitHub PR scanning and basic LLM governance.
          </p>
        </div>
      </div>
    </div>
  );
}
