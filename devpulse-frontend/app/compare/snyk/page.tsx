import Link from "next/link";

export const metadata = {
  title: "Rakshex vs Snyk — Honest Comparison",
  description:
    "Snyk scans static code. Rakshex scans live API traffic. Snyk has no LLM threat coverage or cost intelligence. Compare runtime vs static security analysis.",
};

const features = [
  {
    name: "Analysis Approach",
    snyk: "Static code analysis (SAST) — scans source files",
    rakshex: "Runtime API traffic analysis — scans live requests",
  },
  {
    name: "OWASP API Top 10",
    snyk: "Partial — code patterns only, no runtime context",
    rakshex: "Full OWASP API Top 10 on live traffic",
  },
  {
    name: "Prompt Injection Detection",
    snyk: "Not available — LLM threats not in scope",
    rakshex: "50+ payload patterns, real-time blocking",
  },
  {
    name: "LLM Cost Intelligence",
    snyk: "Not available",
    rakshex: "Per-model, per-agent cost attribution + forecasting",
  },
  {
    name: "Shadow API Detection",
    snyk: "Not available",
    rakshex: "Runtime undocumented endpoint discovery",
  },
  {
    name: "Kill Switch",
    snyk: "Not available",
    rakshex: "Hard stop on budget, anomaly, or red-team score",
  },
  {
    name: "PCI DSS v4.0.1 Compliance",
    snyk: "Code-level vulnerability mapping only",
    rakshex: "Full PCI DSS v4.0.1 runtime compliance reports",
  },
  {
    name: "Agent-level Threat Detection",
    snyk: "Not available",
    rakshex: "MCP tool governance, agent drift detection",
  },
  {
    name: "API Collection Scanning",
    snyk: "Scans code, not Postman/OpenAPI collections",
    rakshex: "Direct Postman, OpenAPI, Bruno import + scan",
  },
  {
    name: "Runtime PII Redaction",
    snyk: "Not available",
    rakshex: "Real-time redaction in live API traffic",
  },
];

export default function CompareSnyk() {
  return (
    <div
      className="min-h-screen bg-background text-on-background p-8"
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
          Rakshex vs Snyk
        </h1>
        <p className="text-on-surface-variant mb-8" style={{ fontSize: "16px", lineHeight: 1.7 }}>
          Snyk is excellent for static code vulnerability scanning. Rakshex operates at the other
          end of the spectrum — scanning live API traffic at runtime, detecting LLM-specific threats
          like prompt injection, and providing cost intelligence Snyk simply does not cover.
        </p>

        <div className="glass-card rounded-xl overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant/20">
                <tr style={{ fontSize: "11px", letterSpacing: "0.1em" }}>
                  <th className="p-4 text-on-surface font-bold">FEATURE</th>
                  <th className="p-4 text-on-surface-variant w-1/3 font-bold">SNYK</th>
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
                      {f.snyk}
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
              When to choose Snyk
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You need static code scanning in CI/CD pipelines</li>
              <li>• Your primary threat model is dependency vulnerabilities</li>
              <li>• You do not have LLM agents in production</li>
              <li>• Runtime API security is handled by another tool</li>
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
              <li>• You need runtime API traffic scanning (not just SAST)</li>
              <li>• You have LLM agents exposed to user input</li>
              <li>• You need prompt injection and shadow API detection</li>
              <li>• You want LLM cost attribution alongside security</li>
              <li>• You need PCI DSS compliance from runtime evidence</li>
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
