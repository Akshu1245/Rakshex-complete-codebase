import Link from "next/link";

export const metadata = {
  title: "RaksHex vs Snyk — Honest Comparison",
  description:
    "Snyk scans repos and dependencies for known vulnerabilities before code ships. RaksHex evaluates what an already-running AI agent is authorized to do at call time.",
};

const features = [
  {
    name: "Primary Security Focus",
    snyk: "Static code vulnerabilities (SAST/SCA)",
    RaksHex: "Runtime action authorization for AI agents",
  },
  {
    name: "Semantic Action Authorization",
    snyk: "No runtime action model",
    RaksHex: "Evaluates each action against delegated authority",
  },
  {
    name: "Delegated Authority & Attenuation",
    snyk: "Not available",
    RaksHex: "Parent-to-child scopes, enforced in code",
  },
  {
    name: "Credential Mediation",
    snyk: "No credential brokering",
    RaksHex: "Fail-closed broker enforces DENY at the credential",
  },
  {
    name: "Tamper-Evident Action Ledger",
    snyk: "No runtime decision ledger",
    RaksHex: "Hash-chained record of every decision",
  },
  {
    name: "Policy Engine",
    snyk: "Not available",
    RaksHex: "Priority-ordered rules evaluated per action",
  },
  {
    name: "MCP Tool Governance",
    snyk: "Scans hardcoded secrets in source",
    RaksHex: "Adversarial-intent scanning on live tool calls",
  },
  {
    name: "Dependency & Code Vulnerability Scanning",
    snyk: "Comprehensive, CI/CD-integrated",
    RaksHex: "Not the primary focus",
  },
  {
    name: "Compliance Evidence",
    snyk: "Code-level vulnerability mapping",
    RaksHex: "SOC 2 audit in progress; ledger data exportable as evidence",
  },
];

export default function CompareSnyk() {
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
          RaksHex vs Snyk
        </h1>
        <p className="text-on-surface-variant mb-8" style={{ fontSize: "16px", lineHeight: 1.7 }}>
          Snyk scans repos and dependencies for known vulnerabilities before code ships. It doesn't
          evaluate what an already-running AI agent is authorized to do at call time. RaksHex
          operates at runtime — authorizing and enforcing each agent action as it happens.
        </p>

        <div className="glass-card rounded-xl overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low/50 border-b border-outline-variant/20">
                <tr style={{ fontSize: "11px", letterSpacing: "0.1em" }}>
                  <th className="p-4 text-on-surface font-bold">FEATURE</th>
                  <th className="p-4 text-on-surface-variant w-1/3 font-bold">SNYK</th>
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
                      {f.snyk}
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
              When to choose Snyk
            </h3>
            <ul className="space-y-2 text-on-surface-variant" style={{ fontSize: "13px" }}>
              <li>• You need static code scanning in CI/CD pipelines</li>
              <li>• Your primary threat model is dependency vulnerabilities</li>
              <li>• You do not have autonomous AI agents in production</li>
              <li>• Runtime action authorization is handled by another layer</li>
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
              <li>• You need runtime authorization, not just pre-ship scanning</li>
              <li>• Agents take real-world actions exposed to user input</li>
              <li>• You need delegated authority that narrows as it's passed down</li>
              <li>• You're governing MCP tool calls for adversarial intent</li>
              <li>• You need a tamper-evident record of every decision</li>
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
