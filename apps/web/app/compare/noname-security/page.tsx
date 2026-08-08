"use client";

import Link from "next/link";

export default function NonameSecurityCompare() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/compare" className="text-blue-400 hover:underline mb-6 block">
          ← All Comparisons
        </Link>

        <h1 className="text-4xl font-bold mb-2">RaksHex vs Noname Security</h1>
        <p className="text-gray-400 mb-10">
          Runtime authorization for AI agent actions vs traditional API discovery and posture
          management.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">RaksHex</h2>
            <ul className="space-y-3 text-sm">
              <li>✅ Semantic action authorization, evaluated at call time</li>
              <li>✅ Delegated authority with parent-to-child attenuation</li>
              <li>✅ Hash-chained, tamper-evident Action Ledger</li>
              <li>✅ Credential mediation — DENY blocks the credential, fail-closed</li>
              <li>✅ MCP tool governance with adversarial-intent scanning</li>
              <li>✅ Priority-ordered policy engine with shadow-mode testing</li>
            </ul>
            <div className="mt-6 text-xs text-emerald-400">
              Best for: Teams running autonomous AI agents that take real-world actions.
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-2xl font-semibold mb-4">Noname Security</h2>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>Strong API discovery and inventory</li>
              <li>Good posture management and risk scoring</li>
              <li>Enterprise-grade for large orgs</li>
              <li>Less emphasis on AI agent authorization or delegated authority</li>
              <li>Heavier implementation for full value</li>
            </ul>
            <div className="mt-6 text-xs">
              Best for: Large enterprises focused purely on classic API inventory.
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Try RaksHex Free
          </Link>
        </div>
      </div>
    </div>
  );
}
