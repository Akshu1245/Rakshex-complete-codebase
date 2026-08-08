import Link from "next/link";

export const metadata = {
  title: "RaksHex vs Lakera Guard — Honest Comparison",
  description:
    "Lakera Guard detects prompt injection at the input layer. RaksHex authorizes the action an agent wants to take, independent of how the prompt was worded. Side-by-side comparison.",
};

const features = [
  {
    name: "Prompt Injection Detection",
    lakera: "Focused, research-backed detection API",
    RaksHex: "Not the primary focus — operates one layer deeper, at the action",
  },
  {
    name: "Semantic Action Authorization",
    lakera: "Not available",
    RaksHex: "Evaluates each action against delegated authority before it runs",
  },
  {
    name: "Delegated Authority & Attenuation",
    lakera: "Not available",
    RaksHex: "Child scope can't exceed parent scope, enforced in code",
  },
  {
    name: "Credential Mediation",
    lakera: "Detection only, no credential control",
    RaksHex: "DENY blocks the credential itself, fail-closed",
  },
  {
    name: "Tamper-Evident Action Ledger",
    lakera: "Not available",
    RaksHex: "Hash-chained record of every authorization decision",
  },
  {
    name: "Policy Engine",
    lakera: "Not available",
    RaksHex: "Priority-ordered rules, with shadow-mode policy testing",
  },
  {
    name: "MCP Tool Governance",
    lakera: "Not available",
    RaksHex: "Adversarial-intent scanning on MCP tool calls",
  },
  {
    name: "PII Detection & Redaction",
    lakera: "Available",
    RaksHex: "Not a primary focus of the current product",
  },
  {
    name: "Compliance Evidence",
    lakera: "Not available",
    RaksHex: "SOC 2 audit in progress; ledger data exportable as evidence",
  },
  {
    name: "Self-hosted Option",
    lakera: "Enterprise only",
    RaksHex: "Available for self-hosted deployments",
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

        <h1 className="text-4xl font-bold mb-2">RaksHex vs Lakera Guard</h1>
        <p className="text-xl text-gray-400 mb-8">
          Lakera Guard focuses on detecting prompt injection at the input layer. RaksHex operates
          one layer deeper — authorizing the action the model wants to take, independent of how the
          prompt was worded, and enforcing that decision at the credential.
        </p>

        <div className="bg-black/50 rounded-xl border border-gray-700 overflow-hidden mb-12">
          <table className="w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 text-white">Feature</th>
                <th className="p-4 text-gray-300 w-1/3">Lakera Guard</th>
                <th className="p-4 text-blue-300 w-1/3">RaksHex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {features.map((f, i) => (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="p-4 font-medium">{f.name}</td>
                  <td className="p-4 text-gray-400">{f.lakera}</td>
                  <td className="p-4 text-gray-200">{f.RaksHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-black/50/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-green-400">When to choose Lakera</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Detecting adversarial or malicious prompts is your core problem</li>
              <li>You want a focused, research-backed detection API</li>
              <li>You already have a separate authorization or credential layer</li>
              <li>You need PII detection at the input/output boundary</li>
            </ul>
          </div>

          <div className="bg-black/50/50 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-3 text-blue-400">When to choose RaksHex</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Agents take real-world actions, not just generate text</li>
              <li>You need delegated authority that narrows as it's passed down</li>
              <li>A DENY needs to actually block the credential, not just flag the prompt</li>
              <li>You need a tamper-evident audit trail of every decision</li>
              <li>You're governing MCP tool calls, not just chat prompts</li>
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
