import Link from "next/link";

export const metadata = {
  title: "Rakshex vs Lakera Guard — Honest Comparison",
  description:
    "Lakera Guard is the leader in prompt injection defense. Rakshex adds API security, compliance, and cost governance. Side-by-side comparison.",
};

const features = [
  {
    name: "Prompt Injection Defense",
    lakera: "Industry-leading (research-backed)",
    rakshex: "Built-in engine with 50+ patterns + heuristic layers",
  },
  {
    name: "PII Detection & Redaction",
    lakera: "Available",
    rakshex: "Available + compliance-grade audit trail",
  },
  {
    name: "API Security Scanning",
    lakera: "Not available",
    rakshex: "Postman / OpenAPI collection scanner",
  },
  {
    name: "Shadow API Detection",
    lakera: "Not available",
    rakshex: "Automatic undocumented endpoint discovery",
  },
  {
    name: "Kill Switch / Budget Cap",
    lakera: "Not available",
    rakshex: "Hard stop + Slack/Email/Webhook alerts",
  },
  {
    name: "Compliance Reporting",
    lakera: "Not available",
    rakshex: "PCI DSS, OWASP, SOC 2 mapped findings",
  },
  {
    name: "LLM Cost Monitoring",
    lakera: "Not available",
    rakshex: "Per-request cost tracking + anomaly detection",
  },
  {
    name: "VS Code Extension",
    lakera: "Not available",
    rakshex: "In-editor scanning + real-time warnings",
  },
  {
    name: "GitHub App / CI Gate",
    lakera: "Not available",
    rakshex: "PR-level security gate with auto-fix",
  },
  {
    name: "Self-hosted Option",
    lakera: "Enterprise only",
    rakshex: "Docker Compose (all tiers)",
  },
];

export default function CompareLakera() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <Link href="/compare" className="hover:text-blue-400">
            ← All comparisons
          </Link>
        </nav>

        <h1 className="text-4xl font-bold mb-2">Rakshex vs Lakera Guard</h1>
        <p className="text-xl text-gray-400 mb-8">
          Lakera Guard is the most advanced prompt injection defense on the market. Rakshex covers
          prompt injection <em>plus</em> API security, compliance, and cost governance.
        </p>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-12">
          <table className="w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 text-white">Feature</th>
                <th className="p-4 text-gray-300 w-1/3">Lakera Guard</th>
                <th className="p-4 text-blue-300 w-1/3">Rakshex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {features.map((f, i) => (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="p-4 font-medium">{f.name}</td>
                  <td className="p-4 text-gray-400">{f.lakera}</td>
                  <td className="p-4 text-gray-200">{f.rakshex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-green-400">When to choose Lakera</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Prompt injection is your only concern</li>
              <li>You want research-grade adversarial testing</li>
              <li>You already have separate API security and compliance tools</li>
              <li>Budget is unlimited for best-in-class defense</li>
            </ul>
          </div>

          <div className="bg-gray-800/50 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-blue-400">When to choose Rakshex</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You need prompt injection + API security + compliance in one tool</li>
              <li>You want self-hosted with Indian data residency</li>
              <li>Cost monitoring and kill switches are required</li>
              <li>You need VS Code and GitHub integration for developer workflows</li>
              <li>You want a unified platform instead of 4+ point solutions</li>
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
