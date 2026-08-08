"use client";

import Link from "next/link";

export default function CompareTraceableAI() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-24 px-4 font-sans">
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
            RaksHex vs Traceable AI
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-3xl">
            Traceable AI excels at enterprise API discovery, traditional threat detection, and
            security posture management for REST/GraphQL traffic. Neither Traceable nor RaksHex's
            other adjacent competitors have a concept of an AI agent's delegated authority or a
            semantic action model — that's the layer RaksHex governs.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="font-bold text-xl mb-4 text-emerald-400">RaksHex</h2>
            <ul className="space-y-2 text-sm">
              <li>✅ Semantic actions, delegated authority, and attenuation</li>
              <li>✅ Fail-closed credential mediation enforces DENY at the credential</li>
              <li>✅ Hash-chained, tamper-evident Action Ledger</li>
              <li>✅ MCP tool governance with adversarial-intent scanning</li>
              <li>✅ Priority-ordered policy engine with shadow-mode testing</li>
              <li>✅ SDK-based integration into the agent's own call path</li>
            </ul>
            <div className="mt-4 text-xs text-emerald-400">
              Best for: Teams shipping autonomous AI agents that take real-world actions.
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="font-bold text-xl mb-4">Traceable AI</h2>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Strong API discovery and inventory at enterprise scale</li>
              <li>Good traditional threat protection and posture management</li>
              <li>Mature for classic REST/GraphQL security programs</li>
              <li>Limited native support for AI agent authority or delegated scopes</li>
              <li>Deployed at the network/API-gateway level, not in the agent's call path</li>
            </ul>
            <div className="mt-4 text-xs">
              Best for: Large enterprises needing broad API inventory and classic API security.
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Try RaksHex
          </Link>
        </div>
      </div>
    </div>
  );
}
