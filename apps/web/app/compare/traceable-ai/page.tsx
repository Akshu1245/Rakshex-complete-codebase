"use client";

import Link from "next/link";

export default function CompareTraceableAI() {
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
            DevPulse vs Traceable AI
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-3xl">
            Traceable AI excels at enterprise API discovery, traditional threat detection, and
            security posture management. DevPulse is an AI-native runtime governance layer built for
            prompt security, LLM cost control, agentic workflows, and deep GitHub integration.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h2 className="font-bold text-xl mb-4 text-emerald-400">DevPulse</h2>
            <ul className="space-y-2 text-sm">
              <li>✅ Real-time PR scanning with secret + heuristic detection + GitHub comments</li>
              <li>
                ✅ LLM-first: prompt injection firewall, thinking token telemetry, cost
                kill-switches
              </li>
              <li>✅ AgentGuard for human-in-the-loop approval of agent tool calls</li>
              <li>✅ Native GitHub App + VS Code integration</li>
              <li>✅ OWASP AI Top 10 + custom runtime policies</li>
              <li>✅ Lightweight and developer-friendly</li>
            </ul>
            <div className="mt-4 text-xs text-emerald-400">
              Best for: Teams shipping heavily with LLMs, Copilot, and autonomous agents.
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h2 className="font-bold text-xl mb-4">Traceable AI</h2>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Strong API discovery and inventory at enterprise scale</li>
              <li>Good traditional threat protection and posture management</li>
              <li>Mature for classic REST/GraphQL security programs</li>
              <li>Limited native LLM prompt evaluation or cost attribution</li>
              <li>Less emphasis on developer workflow (PR comments, IDE, agents)</li>
            </ul>
            <div className="mt-4 text-xs">
              Best for: Large enterprises needing broad API inventory and classic API security.
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Try DevPulse
          </Link>
          <p className="text-xs mt-3 text-slate-500">
            Free tier includes GitHub PR scanning and LLM governance.
          </p>
        </div>
      </div>
    </div>
  );
}
