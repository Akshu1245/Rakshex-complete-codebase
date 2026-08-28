import Link from "next/link";

export const metadata = {
  title: "RaksHex vs Helicone — Honest Comparison",
  description:
    "Helicone logs and routes LLM requests. RaksHex authorizes and enforces what an AI agent is allowed to do at call time. Side-by-side feature comparison.",
};

const features = [
  {
    name: "LLM Request Logging & Tracing",
    helicone: "Comprehensive (logs, traces, latency)",
    RaksHex: "Not the primary focus — action-level audit, not request tracing",
  },
  {
    name: "Semantic Action Authorization",
    helicone: "Not available",
    RaksHex: "Every action (e.g. financial.refund) evaluated at call time",
  },
  {
    name: "Delegated Authority & Attenuation",
    helicone: "Not available",
    RaksHex: "Parent-to-child scopes, enforced so a child can't exceed its parent",
  },
  {
    name: "Credential Mediation",
    helicone: "Not available",
    RaksHex: "Fail-closed broker; DENY blocks the credential, not just the route",
  },
  {
    name: "Tamper-Evident Action Ledger",
    helicone: "Request logs, not a decision ledger",
    RaksHex: "Hash-chained record of every authorization decision",
  },
  {
    name: "Policy Engine",
    helicone: "Not available",
    RaksHex: "Priority-ordered rules evaluated per action, with shadow-mode testing",
  },
  {
    name: "MCP Tool Governance",
    helicone: "Not available",
    RaksHex: "Adversarial-intent scanning on MCP tool calls",
  },
  {
    name: "Compliance Evidence",
    helicone: "Not available",
    RaksHex: "Framework mapping; policy and ledger data exportable as evidence; not a certification",
  },
  {
    name: "Rate Limiting / Fallback Routing",
    helicone: "Advanced (caching, retries, fallbacks)",
    RaksHex: "Not the primary focus",
  },
  {
    name: "Deployment",
    helicone: "Managed gateway",
    RaksHex: "SDK integrated into the agent's call path",
  },
];

export default function CompareHelicone() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <Link href="/compare" className="hover:text-blue-400">
            ← All comparisons
          </Link>
        </nav>

        <h1 className="text-4xl font-bold mb-2">RaksHex vs Helicone</h1>
        <p className="text-xl text-gray-400 mb-8">
          Helicone is built for LLM observability — logging, tracing, and routing requests. RaksHex
          answers a different question: whether a specific agent action should be allowed to happen
          at all, and enforces that decision at the credential.
        </p>

        <div className="bg-black/50 rounded-xl border border-gray-700 overflow-hidden mb-12">
          <table className="w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 text-white">Feature</th>
                <th className="p-4 text-gray-300 w-1/3">Helicone</th>
                <th className="p-4 text-blue-300 w-1/3">RaksHex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {features.map((f, i) => (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="p-4 font-medium">{f.name}</td>
                  <td className="p-4 text-gray-400">{f.helicone}</td>
                  <td className="p-4 text-gray-200">{f.RaksHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-black/50/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-green-400">When to choose Helicone</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You need request-level logging, tracing, and latency metrics</li>
              <li>Caching and fallback routing across model providers matter most</li>
              <li>You already have a separate authorization or policy layer</li>
              <li>Observability, not enforcement, is the immediate gap</li>
            </ul>
          </div>

          <div className="bg-black/50/50 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-blue-400">When to choose RaksHex</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Agents take real-world actions (payments, data writes, API calls)</li>
              <li>You need a DENY to actually block the action, not just log it</li>
              <li>Delegated authority needs to shrink, not widen, as it's passed down</li>
              <li>You need a tamper-evident record of every authorization decision</li>
              <li>You're evaluating MCP tool calls for adversarial intent</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/demo"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Try RaksHex Free →
          </Link>
        </div>
      </div>
    </div>
  );
}
