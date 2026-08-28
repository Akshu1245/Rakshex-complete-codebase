import Link from "next/link";

export const metadata = {
  title: "RaksHex vs Datadog — Honest Comparison",
  description:
    "Datadog observes and alerts on infrastructure after the fact. RaksHex authorizes individual AI agent actions before they execute. Side-by-side comparison.",
};

const features = [
  {
    name: "Enforcement vs Observability",
    datadog: "Alerts after the fact",
    RaksHex: "Blocks the action before it executes",
  },
  {
    name: "Semantic Action Authorization",
    datadog: "Not available",
    RaksHex: "Evaluates each agent action against delegated authority",
  },
  {
    name: "Delegated Authority Model",
    datadog: "No authority/attenuation concept",
    RaksHex: "Parent-to-child attenuation, enforced in code",
  },
  {
    name: "Credential Mediation",
    datadog: "Not available",
    RaksHex: "Fail-closed broker; DENY blocks the credential itself",
  },
  {
    name: "Policy Engine",
    datadog: "Custom alerting rules, not authorization",
    RaksHex: "Priority-ordered rules evaluated per action",
  },
  {
    name: "MCP-Aware Monitoring",
    datadog: "No MCP-specific tooling",
    RaksHex: "Adversarial-intent scanning on MCP tool calls",
  },
  {
    name: "Auditable Decision Trail",
    datadog: "General-purpose log retention",
    RaksHex: "Hash-chained, tamper-evident Action Ledger",
  },
  {
    name: "Infrastructure APM / Host Monitoring",
    datadog: "Comprehensive",
    RaksHex: "Not the primary focus",
  },
  {
    name: "Compliance Evidence",
    datadog: "General log collection",
    RaksHex: "Framework mapping and ledger export as evidence; not a certification",
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
          RaksHex vs Datadog
        </h1>
        <p className="text-on-surface-variant mb-8" style={{ fontSize: "16px", lineHeight: 1.7 }}>
          Datadog is built to observe and alert on infrastructure after something already happened.
          It has no concept of authorizing an individual AI agent action before it executes. RaksHex
          governs the action itself — evaluating and enforcing a decision at call time.
        </p>

        <div className="glass-card rounded-xl overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant/20">
                <tr style={{ fontSize: "11px", letterSpacing: "0.1em" }}>
                  <th className="p-4 text-on-surface font-bold">FEATURE</th>
                  <th className="p-4 text-on-surface-variant w-1/3 font-bold">DATADOG</th>
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
                      {f.datadog}
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
              When to choose Datadog
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You need infrastructure APM and host-level monitoring</li>
              <li>• Your primary need is logs, traces, and dashboards</li>
              <li>• You have no autonomous AI agents taking real-world actions</li>
              <li>• Action-level authorization is handled by a separate layer</li>
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
              <li>• You run autonomous AI agents that take real-world actions</li>
              <li>• You need a DENY that blocks the action before it executes</li>
              <li>• Delegated authority needs to narrow as it's passed to sub-agents</li>
              <li>• You need a tamper-evident record of every authorization decision</li>
              <li>• You're governing MCP tool calls, not just infrastructure metrics</li>
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
