import Link from "next/link";

export const metadata = {
  title: "RaksHex vs Helicone — Honest Comparison",
  description:
    "Helicone is great for AI observability. RaksHex adds security scanning, compliance, and kill switches. Side-by-side feature comparison.",
};

const features = [
  {
    name: "LLM Observability",
    helicone: "Comprehensive (logs, traces, latency)",
    RaksHex: "Full observability + cost anomaly detection",
  },
  {
    name: "Prompt Injection Detection",
    helicone: "Not available",
    RaksHex: "Built-in with 50+ payload patterns",
  },
  {
    name: "API Security Scanning",
    helicone: "Not available",
    RaksHex: "Postman / OpenAPI collection scanner",
  },
  {
    name: "Shadow API Detection",
    helicone: "Not available",
    RaksHex: "Automatic undocumented endpoint discovery",
  },
  {
    name: "Kill Switch / Budget Cap",
    helicone: "Basic alerting only",
    RaksHex: "Hard stop + Slack/Email + Webhook alerts",
  },
  {
    name: "Compliance Reporting",
    helicone: "Not available",
    RaksHex: "PCI DSS, OWASP, SOC 2 mapped findings",
  },
  {
    name: "PII Redaction",
    helicone: "Not available",
    RaksHex: "Real-time redaction in request/response",
  },
  {
    name: "VS Code Extension",
    helicone: "Not available",
    RaksHex: "In-editor scanning + inline warnings",
  },
  {
    name: "GitHub Actions Integration",
    helicone: "Not available",
    RaksHex: "PR-level security gate with comments",
  },
  {
    name: "Pricing (Starter)",
    helicone: "$0 / 10K requests/mo",
    RaksHex: "$0 / unlimited scans (self-hosted)",
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
          Helicone is the gold standard for AI observability. RaksHex covers observability{" "}
          <em>plus</em> the security and governance layer most teams discover they need 6 months
          later.
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
              <li>You only need request logging and latency metrics</li>
              <li>You are not handling sensitive user data</li>
              <li>Budget alerts (not hard stops) are sufficient</li>
              <li>You do not need compliance certifications</li>
            </ul>
          </div>

          <div className="bg-black/50/50 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-blue-400">When to choose RaksHex</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>You handle PII, financial data, or health records</li>
              <li>You need PCI DSS, SOC 2, or OWASP compliance reports</li>
              <li>You want a kill switch that actually stops traffic</li>
              <li>You need API security scanning (shadow endpoints, auth gaps)</li>
              <li>You want everything in one platform instead of 3 tools</li>
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
