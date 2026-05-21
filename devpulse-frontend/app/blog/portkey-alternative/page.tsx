import Link from "next/link";

export const metadata = {
  title: "Best Portkey Alternative for AI Governance (2026) — Rakshex",
  description:
    "Portkey is the best LLM gateway. Rakshex adds security scanning, compliance reporting, and a real kill switch. Honest comparison.",
  keywords: [
    "Portkey alternative",
    "Portkey vs Rakshex",
    "LLM gateway security",
    "AI governance",
    "prompt injection",
  ],
  alternates: { canonical: "/blog/portkey-alternative" },
};

export default function BlogPortkeyAlternative() {
  return (
    <article className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <Link href="/blog" className="hover:text-blue-400">
            ← Blog
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-3">
            Best Portkey Alternative for AI Governance (2026)
          </h1>
          <p className="text-gray-400">Published May 2026 · 6 min read</p>
        </header>

        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed space-y-5">
          <p className="text-xl text-gray-200">
            Portkey has the most sophisticated LLM routing and fallback system on the market. If you
            need multi-provider load balancing, it is the right tool. But routing is not governance.
            This post covers what Portkey does not — and why teams are adding Rakshex.
          </p>

          <h2 className="text-2xl font-bold text-white mt-8">What Portkey Does Well</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Multi-provider routing with automatic fallbacks</li>
            <li>Prompt versioning and A/B testing playground</li>
            <li>Virtual keys for team access control</li>
            <li>Request caching with hit-rate analytics</li>
            <li>Fine-grained retries and timeouts</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mt-8">Where Portkey Leaves Gaps</h2>
          <p>
            Portkey's philosophy is "route safely." Rakshex's is "route safely, scan for threats,
            and stop traffic if something is wrong." The gaps:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>No prompt injection detection — routed attacks reach the model</li>
            <li>No PII redaction before third-party providers</li>
            <li>No API security scanning (shadow endpoints, auth gaps)</li>
            <li>Rate limits only, not a true budget kill switch</li>
            <li>No compliance reporting (PCI DSS, OWASP, SOC 2)</li>
          </ul>

          <h2 className="text-2xl font-bold text-white mt-8">
            Rakshex vs Portkey: Governance Comparison
          </h2>
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden my-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="p-3">Capability</th>
                  <th className="p-3 text-center">Portkey</th>
                  <th className="p-3 text-center text-blue-300">Rakshex</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {[
                  ["Multi-provider routing", "✅ Advanced", "✅ Basic"],
                  ["Prompt versioning", "✅", "⚠️ Via collections"],
                  ["Fallback chains", "✅", "⚠️ Via policies"],
                  ["Prompt injection detection", "❌", "✅"],
                  ["PII redaction", "❌", "✅"],
                  ["Shadow API detection", "❌", "✅"],
                  ["Kill switch / hard stop", "❌", "✅"],
                  ["Cost anomaly detection", "⚠️ Basic", "✅ Advanced"],
                  ["Compliance reporting", "❌", "✅"],
                  ["VS Code extension", "❌", "✅"],
                  ["Self-hosted", "❌ Enterprise only", "✅ All tiers"],
                ].map(([cap, port, dev]) => (
                  <tr key={cap}>
                    <td className="p-3">{cap}</td>
                    <td className="p-3 text-center">{port}</td>
                    <td className="p-3 text-center">{dev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-bold text-white mt-8">When to Use Both</h2>
          <p>If you need Portkey's advanced routing AND Rakshex's security, you can run both:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Keep Portkey as your LLM router</li>
            <li>
              Route Rakshex <em>after</em> Portkey for security scanning
            </li>
            <li>Rakshex captures the final request/response for audit + cost tracking</li>
          </ol>
          <p>
            Most teams eventually simplify to Rakshex alone once they realize the routing they
            thought they needed was mostly workaround for missing security controls.
          </p>

          <h2 className="text-2xl font-bold text-white mt-8">The Verdict</h2>
          <p>
            Portkey is the best router. Rakshex is the best security + governance layer. If you only
            need routing, Portkey wins. If you need to ship AI to production safely, Rakshex closes
            the gaps Portkey is not designed to cover.
          </p>
        </div>

        <div className="mt-10 p-6 bg-blue-900/20 border border-blue-500/30 rounded-xl text-center">
          <p className="text-blue-300 mb-4">See the security layer Portkey does not provide.</p>
          <Link
            href="/demo"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Try Rakshex Free →
          </Link>
        </div>
      </div>
    </article>
  );
}
