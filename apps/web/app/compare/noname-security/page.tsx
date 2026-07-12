"use client";

import Link from "next/link";

export default function NonameSecurityCompare() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/compare" className="text-blue-400 hover:underline mb-6 block">
          ← All Comparisons
        </Link>

        <h1 className="text-4xl font-bold mb-2">DevPulse vs Noname Security</h1>
        <p className="text-gray-400 mb-10">
          Real-time API security + AI governance vs traditional API discovery and posture
          management.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">DevPulse</h2>
            <ul className="space-y-3 text-sm">
              <li>✅ Real-time PR scanning with secret detection + code heuristics</li>
              <li>✅ LLM cost monitoring, kill-switch, and shadow AI detection</li>
              <li>✅ OWASP + compliance scoring + unified risk</li>
              <li>✅ GitHub App native PR comments</li>
              <li>✅ VS Code extension + runtime governance</li>
              <li>✅ Open source friendly rules + fast iteration</li>
            </ul>
            <div className="mt-6 text-xs text-emerald-400">
              Best for: Modern AI-heavy engineering teams that ship fast.
            </div>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h2 className="text-2xl font-semibold mb-4">Noname Security</h2>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>Strong API discovery and inventory</li>
              <li>Good posture management and risk scoring</li>
              <li>Enterprise-grade for large orgs</li>
              <li>Less emphasis on real-time PR feedback or LLM cost control</li>
              <li>Heavier implementation for full value</li>
            </ul>
            <div className="mt-6 text-xs">
              Best for: Large enterprises focused purely on API inventory.
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Try DevPulse Free
          </Link>
        </div>
      </div>
    </div>
  );
}
