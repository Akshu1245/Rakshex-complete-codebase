import Link from "next/link";

export const metadata = {
  title: "Rakshex vs Portkey — Honest Comparison",
  description:
    "Portkey is an excellent LLM gateway. Rakshex adds security scanning, compliance, and enterprise governance. Side-by-side comparison.",
};

const features = [
  {
    name: "LLM Gateway / Router",
    portkey: "Advanced (fallbacks, retries, load balancing)",
    rakshex: "Basic routing + kill switch integration",
  },
  {
    name: "Prompt Management",
    portkey: "Versioned prompt playground",
    rakshex: "Policy-based prompt guards",
  },
  {
    name: "Prompt Injection Detection",
    portkey: "Not available",
    rakshex: "Built-in engine with 50+ payloads",
  },
  {
    name: "API Security Scanning",
    portkey: "Not available",
    rakshex: "Postman / OpenAPI scanner + credential leak detection",
  },
  {
    name: "Shadow API Detection",
    portkey: "Not available",
    rakshex: "Automatic discovery of undocumented endpoints",
  },
  {
    name: "Compliance Reporting",
    portkey: "Not available",
    rakshex: "PCI DSS, OWASP, SOC 2 mapped controls",
  },
  {
    name: "Kill Switch / Budget Enforcement",
    portkey: "Basic rate limits",
    rakshex: "Hard kill switch + budget cap + multi-channel alerts",
  },
  {
    name: "VS Code Extension",
    portkey: "Not available",
    rakshex: "In-editor scanning + real-time warnings",
  },
  {
    name: "GitHub App / PR Scanning",
    portkey: "Not available",
    rakshex: "PR-level security gate + auto-fix suggestions",
  },
  {
    name: "On-premise / Self-hosted",
    portkey: "Enterprise plan only",
    rakshex: "Docker Compose (free tier)",
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

        <h1 className="text-4xl font-bold mb-2">Rakshex vs Portkey</h1>
        <p className="text-xl text-gray-400 mb-8">
          Portkey is the best LLM gateway and router on the market. If you need gateway features +
          security + compliance in one stack, Rakshex covers the gaps Portkey leaves open.
        </p>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-12">
          <table className="w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 text-white">Feature</th>
                <th className="p-4 text-gray-300 w-1/3">Portkey</th>
                <th className="p-4 text-blue-300 w-1/3">Rakshex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {features.map((f, i) => (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="p-4 font-medium">{f.name}</td>
                  <td className="p-4 text-gray-400">{f.portkey}</td>
                  <td className="p-4 text-gray-200">{f.rakshex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-green-400">When to choose Portkey</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You need sophisticated LLM routing and failover</li>
              <li>Prompt versioning and A/B testing are critical</li>
              <li>You want a managed gateway (not self-hosted)</li>
              <li>Security is handled by another team/tool</li>
            </ul>
          </div>

          <div className="bg-gray-800/50 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-blue-400">When to choose Rakshex</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You need a kill switch that stops traffic, not just alerts</li>
              <li>Compliance (PCI DSS, SOC 2) is non-negotiable</li>
              <li>You want to scan API collections for security gaps</li>
              <li>You prefer self-hosted with full data sovereignty</li>
              <li>You want one platform instead of gateway + security + compliance tools</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/demo"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Try Rakshex Free →
          </Link>
        </div>
      </div>
    </div>
  );
}
