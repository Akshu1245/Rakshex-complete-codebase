import Link from "next/link";

export const metadata = {
  title: "RaksHex vs LangSmith — Honest Comparison",
  description:
    "LangSmith is observability-only with no security scanning. RaksHex adds OWASP scanning, thinking token attribution, PCI DSS compliance, and real kill switches.",
};

const features = [
  {
    name: "LLM Observability",
    langsmith: "Comprehensive (traces, runs, feedback)",
    RaksHex: "Full observability + cost anomaly detection",
  },
  {
    name: "Security Scanning",
    langsmith: "Not available — observability only",
    RaksHex: "OWASP API Top 10 + prompt injection blocking",
  },
  {
    name: "Thinking Token Attribution",
    langsmith: "Not available",
    RaksHex: "First-in-world: isolates reasoning tokens (o1/o3/Claude)",
  },
  {
    name: "PCI DSS Compliance",
    langsmith: "Not available",
    RaksHex: "PCI DSS v4.0.1 mapped findings + export",
  },
  {
    name: "Kill Switch / Budget Cap",
    langsmith: "Not available",
    RaksHex: "Hard stop on budget, anomaly, or red-team score",
  },
  {
    name: "PII Redaction",
    langsmith: "Manual masking only",
    RaksHex: "Real-time auto-redaction in request/response",
  },
  {
    name: "Shadow API Detection",
    langsmith: "Not available",
    RaksHex: "Static + runtime undocumented endpoint discovery",
  },
  {
    name: "Cost Attribution per Agent",
    langsmith: "Per-run cost logging",
    RaksHex: "Per-agent, per-model, per-thinking-token breakdown",
  },
  {
    name: "VS Code Extension",
    langsmith: "Not available",
    RaksHex: "In-editor scanning + inline security warnings",
  },
  {
    name: "Compliance Reports",
    langsmith: "Not available",
    RaksHex: "SOC 2, PCI DSS, OWASP — JSON/CSV/PDF export",
  },
];

export default function CompareLangsmith() {
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
          RaksHex vs LangSmith
        </h1>
        <p className="text-on-surface-variant mb-8" style={{ fontSize: "16px", lineHeight: 1.7 }}>
          LangSmith excels at LLM observability and debugging. But it stops there — no security
          scanning, no compliance, no kill switch. RaksHex covers observability <em>plus</em> the
          full security and governance layer teams need once they ship AI to production.
        </p>

        <div className="glass-card rounded-xl overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant/20">
                <tr style={{ fontSize: "11px", letterSpacing: "0.1em" }}>
                  <th className="p-4 text-on-surface font-bold">FEATURE</th>
                  <th className="p-4 text-on-surface-variant w-1/3 font-bold">LANGSMITH</th>
                  <th className="p-4 text-primary w-1/3 font-bold">RaksHex</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {features.map((f, i) => (
                  <tr key={i} className="hover:bg-surface-variant/10 transition-colors">
                    <td className="p-4 text-on-surface font-medium" style={{ fontSize: "13px" }}>
                      {f.name}
                    </td>
                    <td className="p-4 text-on-surface-variant" style={{ fontSize: "13px" }}>
                      {f.langsmith}
                    </td>
                    <td className="p-4 text-on-surface" style={{ fontSize: "13px" }}>
                      {f.RaksHex}
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
              When to choose LangSmith
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You only need LLM run tracing and debugging</li>
              <li>• You are deep in the LangChain ecosystem</li>
              <li>• Security and compliance are handled separately</li>
              <li>• You do not need kill switch or budget caps</li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-6 border border-primary/30">
            <h3
              className="font-bold mb-3 text-primary"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px" }}
            >
              When to choose RaksHex
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You need security + observability in one platform</li>
              <li>• You handle PII, financial data, or health records</li>
              <li>• You want thinking token attribution (o1/o3/Claude)</li>
              <li>• You need PCI DSS or SOC 2 compliance evidence</li>
              <li>• You want a kill switch that actually halts traffic</li>
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-primary text-on-primary font-bold hover:shadow-[0_0_20px_rgba(207,188,255,0.4)] transition-all"
            style={{ fontSize: "12px", letterSpacing: "0.1em" }}
          >
            TRY RaksHex FREE →
          </Link>
        </div>
      </div>
    </div>
  );
}
