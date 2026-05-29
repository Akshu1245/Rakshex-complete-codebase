import Link from "next/link";

export const metadata = {
  title: "Rakshex vs Datadog — Honest Comparison",
  description:
    "Datadog charges per host with no OWASP API scanning or LLM-specific features. Rakshex is per-API with built-in security, cost attribution, and PCI DSS compliance.",
};

const features = [
  {
    name: "Pricing Model",
    datadog: "Per host/container — costs explode at scale",
    rakshex: "Per-API — predictable pricing regardless of infra",
  },
  {
    name: "OWASP API Top 10 Scanning",
    datadog: "Not available",
    rakshex: "Full OWASP API Top 10 + custom payload library",
  },
  {
    name: "LLM Cost Attribution",
    datadog: "Basic metrics only, no per-model breakdown",
    rakshex: "Per-model, per-agent, thinking token attribution",
  },
  {
    name: "Prompt Injection Detection",
    datadog: "Not available",
    rakshex: "50+ payload patterns, real-time blocking",
  },
  {
    name: "Shadow API Detection",
    datadog: "Not available",
    rakshex: "Static route extraction + runtime discovery",
  },
  {
    name: "Kill Switch / Budget Cap",
    datadog: "Alerts only — no hard stops",
    rakshex: "Hard stop on budget, anomaly, or red-team score",
  },
  {
    name: "PCI DSS v4.0.1 Compliance",
    datadog: "Partial log collection only",
    rakshex: "Full PCI DSS v4.0.1 mapped findings + reports",
  },
  {
    name: "PII Redaction",
    datadog: "Manual scrubbing rules only",
    rakshex: "Real-time auto-redaction in request/response",
  },
  {
    name: "VS Code Extension",
    datadog: "Not available",
    rakshex: "In-editor scanning + inline security warnings",
  },
  {
    name: "India-specific Compliance (Aadhaar/PAN)",
    datadog: "Not available",
    rakshex: "Built-in Aadhaar & PAN detection rules",
  },
];

export default function CompareDatadog() {
  return (
    <div
      className="min-h-screen bg-transparent text-on-background p-8"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-on-surface-variant mb-6">
          <Link href="/compare" className="hover:text-primary transition-colors">
            ← All comparisons
          </Link>
        </nav>

        <h1
          className="mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "36px", fontWeight: 700 }}
        >
          Rakshex vs Datadog
        </h1>
        <p className="text-on-surface-variant mb-8" style={{ fontSize: "16px", lineHeight: 1.7 }}>
          Datadog is the gold standard for infrastructure monitoring. But it charges per host, has
          no OWASP API scanning, and zero LLM-specific security features. Rakshex is built
          specifically for API security and AI cost intelligence — at a fraction of the cost.
        </p>

        <div className="glass-card rounded-xl overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant/20">
                <tr style={{ fontSize: "11px", letterSpacing: "0.1em" }}>
                  <th className="p-4 text-on-surface font-bold">FEATURE</th>
                  <th className="p-4 text-on-surface-variant w-1/3 font-bold">DATADOG</th>
                  <th className="p-4 text-primary w-1/3 font-bold">RAKSHEX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {features.map((f, i) => (
                  <tr key={i} className="hover:bg-surface-variant/10 transition-colors">
                    <td className="p-4 text-on-surface font-medium" style={{ fontSize: "13px" }}>
                      {f.name}
                    </td>
                    <td className="p-4 text-on-surface-variant" style={{ fontSize: "13px" }}>
                      {f.datadog}
                    </td>
                    <td className="p-4 text-on-surface" style={{ fontSize: "13px" }}>
                      {f.rakshex}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="glass-card rounded-xl p-6">
            <h3
              className="font-bold mb-3 text-on-surface-variant"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px" }}
            >
              When to choose Datadog
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You need infrastructure APM and host-level monitoring</li>
              <li>• Your primary need is logs, traces, and dashboards</li>
              <li>• You have no LLM agents in production</li>
              <li>• Security scanning is handled by a separate tool</li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-6 border border-primary/30">
            <h3
              className="font-bold mb-3 text-primary"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px" }}
            >
              When to choose Rakshex
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You need OWASP API scanning + LLM cost control in one tool</li>
              <li>• You want per-API pricing instead of per-host billing</li>
              <li>• You need PCI DSS or SOC 2 compliance reports</li>
              <li>• You run AI agents and need kill switch protection</li>
              <li>• You operate in India and need Aadhaar/PAN detection</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-primary text-on-primary font-bold hover:shadow-[0_0_20px_rgba(207,188,255,0.4)] transition-all"
            style={{ fontSize: "12px", letterSpacing: "0.1em" }}
          >
            TRY RAKSHEX FREE →
          </Link>
        </div>
      </div>
    </div>
  );
}
