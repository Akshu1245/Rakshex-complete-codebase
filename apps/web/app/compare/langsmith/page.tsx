import Link from "next/link";

export const metadata = {
  title: "RaksHex vs LangSmith — Honest Comparison",
  description:
    "LangSmith is built for LLM run tracing and debugging. RaksHex authorizes and enforces what an AI agent is allowed to do at runtime. Side-by-side comparison.",
};

const features = [
  {
    name: "LLM Run Tracing & Debugging",
    langsmith: "Comprehensive (traces, runs, feedback)",
    RaksHex: "Not the primary focus",
  },
  {
    name: "Semantic Action Authorization",
    langsmith: "Not available — observability only",
    RaksHex: "Every action evaluated against delegated authority at call time",
  },
  {
    name: "Delegated Authority & Attenuation",
    langsmith: "Not available",
    RaksHex: "Parent-to-child scopes, enforced so a child can't exceed its parent",
  },
  {
    name: "Credential Mediation",
    langsmith: "Not available",
    RaksHex: "Fail-closed broker; DENY blocks the credential itself",
  },
  {
    name: "Tamper-Evident Action Ledger",
    langsmith: "Run logs, not a decision ledger",
    RaksHex: "Hash-chained record of every authorization decision",
  },
  {
    name: "Policy Engine",
    langsmith: "Not available",
    RaksHex: "Priority-ordered rules, with shadow-mode policy testing",
  },
  {
    name: "MCP Tool Governance",
    langsmith: "Not available",
    RaksHex: "Adversarial-intent scanning on MCP tool calls",
  },
  {
    name: "Cost / Usage Logging per Run",
    langsmith: "Per-run cost logging",
    RaksHex: "Not the primary focus of the current product",
  },
  {
    name: "Compliance Evidence",
    langsmith: "Not available",
    RaksHex: "Framework mapping and ledger export as evidence; not a certification",
  },
  {
    name: "LangChain Ecosystem Integration",
    langsmith: "Native, deep integration",
    RaksHex: "Framework-agnostic SDK integrated into the agent's call path",
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
          LangSmith excels at LLM run tracing and debugging — understanding what an agent did.
          RaksHex answers a different question: whether a specific agent action should be allowed to
          happen at all, and enforces that decision at the credential.
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
              <li>• Action-level authorization is handled by a separate layer</li>
              <li>• Your agents don't take consequential real-world actions</li>
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
              <li>• Agents take real-world actions (payments, data writes, API calls)</li>
              <li>• You need a DENY that actually blocks the credential</li>
              <li>• Delegated authority needs to narrow as it's passed to sub-agents</li>
              <li>• You need a tamper-evident record of every decision</li>
              <li>• You're governing MCP tool calls, not just tracing runs</li>
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
