import Link from "next/link";

export const metadata = {
  title: "RaksHex vs Portkey — Honest Comparison",
  description:
    "Portkey and Helicone route and log LLM traffic. RaksHex authorizes and enforces individual agent actions at call time. Side-by-side comparison.",
};

const features = [
  {
    name: "LLM Gateway / Router",
    portkey: "Advanced (fallbacks, retries, load balancing)",
    RaksHex: "Not the primary focus",
  },
  {
    name: "Action-Level Authorization",
    portkey: "Rate limiting & fallback routing, not authorization",
    RaksHex: "Every semantic action evaluated at call time",
  },
  {
    name: "Delegated Authority",
    portkey: "Not available",
    RaksHex: "Parent-to-child attenuation, enforced in code",
  },
  {
    name: "Credential Mediation",
    portkey: "Gateway-level key management",
    RaksHex: "Claim-before-spend, no-redirect broker; DENY blocks the credential",
  },
  {
    name: "Tamper-Evident Ledger",
    portkey: "Request logs, not a decision ledger",
    RaksHex: "Hash-chained Action Ledger",
  },
  {
    name: "Policy Engine",
    portkey: "Not available",
    RaksHex: "Priority-ordered rules evaluated per action",
  },
  {
    name: "MCP Tool Governance",
    portkey: "Not available",
    RaksHex: "Adversarial-intent scanning on tool calls",
  },
  {
    name: "Enforced Denial",
    portkey: "Manual key revocation to actually stop a caller",
    RaksHex: "DENY blocks the credential, not just the route",
  },
  {
    name: "Prompt Versioning / Playground",
    portkey: "Versioned prompt management",
    RaksHex: "Not available",
  },
  {
    name: "Self-hosted Option",
    portkey: "Enterprise plan only",
    RaksHex: "Available for self-hosted deployments",
  },
];

export default function ComparePortkey() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <Link href="/compare" className="hover:text-blue-400">
            ← All comparisons
          </Link>
        </nav>

        <h1 className="text-4xl font-bold mb-2">RaksHex vs Portkey</h1>
        <p className="text-xl text-gray-400 mb-8">
          Portkey routes and logs LLM traffic. Routing tells you a request went through — it doesn't
          tell you whether that specific action should have been allowed. RaksHex evaluates and
          enforces that decision.
        </p>

        <div className="bg-black/50 rounded-xl border border-gray-700 overflow-hidden mb-12">
          <table className="w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 text-white">Feature</th>
                <th className="p-4 text-gray-300 w-1/3">Portkey</th>
                <th className="p-4 text-blue-300 w-1/3">RaksHex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {features.map((f, i) => (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="p-4 font-medium">{f.name}</td>
                  <td className="p-4 text-gray-400">{f.portkey}</td>
                  <td className="p-4 text-gray-200">{f.RaksHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-black/50/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-green-400">When to choose Portkey</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You need sophisticated LLM routing and failover</li>
              <li>Prompt versioning and A/B testing are critical</li>
              <li>You want a managed gateway (not self-hosted)</li>
              <li>Action-level authorization is handled by another layer</li>
            </ul>
          </div>

          <div className="bg-black/50/50 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-blue-400">When to choose RaksHex</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You need a DENY that actually blocks the credential, not just an alert</li>
              <li>Delegated authority needs to narrow, not widen, as it's passed down</li>
              <li>You need a tamper-evident record of every authorization decision</li>
              <li>You prefer self-hosted with full data sovereignty</li>
              <li>You're governing MCP tool calls as well as model calls</li>
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
