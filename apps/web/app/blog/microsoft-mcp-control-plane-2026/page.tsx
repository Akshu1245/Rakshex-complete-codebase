import Link from "next/link";

export const metadata = {
  title: "Microsoft Says MCP Needs a Policy Point Before Tool Execution",
  description:
    "Microsoft's Agent Governance Toolkit targets the missing policy layer around MCP tool execution. Why that validates runtime agent authorization.",
  alternates: { canonical: "/blog/microsoft-mcp-control-plane-2026" },
};

export default function MicrosoftMcpControlPlanePost() {
  return (
    <article className="min-h-screen bg-transparent text-slate-100 px-6 pt-28 pb-20">
      <div className="max-w-3xl mx-auto">
        <Link href="/blog" className="text-sm text-[#14B8A6] hover:underline">← Back to Blog</Link>
        <header className="mt-6 mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[#14B8A6] mb-3">MCP security · 1 September 2026</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Microsoft says MCP needs a policy point before tool execution.
          </h1>
          <p className="mt-5 text-lg text-slate-300 leading-8">
            MCP makes tools easier for agents to discover and call. Microsoft’s security team points out the missing piece: the protocol does not itself decide whether a specific call should be allowed before it executes.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 md:p-8 mb-10 overflow-hidden">
          <svg viewBox="0 0 900 390" className="w-full h-auto" role="img" aria-label="MCP tool call passes through governance before execution">
            <rect width="900" height="390" rx="24" fill="#07111b" />
            <g fontFamily="sans-serif">
              <rect x="45" y="145" width="150" height="86" rx="16" fill="#111827" stroke="#334155" />
              <text x="120" y="178" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">Agent</text>
              <text x="120" y="204" textAnchor="middle" fill="#94a3b8" fontSize="13">tool intent</text>
              <path d="M195 188 H290" stroke="#14B8A6" strokeWidth="4" markerEnd="url(#a)" />
              <rect x="290" y="95" width="320" height="190" rx="18" fill="#0f172a" stroke="#14B8A6" />
              <text x="450" y="132" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="700">Runtime governance</text>
              <text x="450" y="166" textAnchor="middle" fill="#cbd5e1" fontSize="13">identity · tool · arguments · resource</text>
              <text x="450" y="198" textAnchor="middle" fill="#cbd5e1" fontSize="13">policy · approval · circuit breaker</text>
              <text x="450" y="235" textAnchor="middle" fill="#5eead4" fontSize="14">ALLOW · DENY · REQUIRE APPROVAL</text>
              <path d="M610 188 H705" stroke="#14B8A6" strokeWidth="4" markerEnd="url(#a)" />
              <rect x="705" y="145" width="150" height="86" rx="16" fill="#111827" stroke="#334155" />
              <text x="780" y="178" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">MCP tool</text>
              <text x="780" y="204" textAnchor="middle" fill="#94a3b8" fontSize="13">execution</text>
              <defs><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#14B8A6" /></marker></defs>
            </g>
          </svg>
        </div>

        <div className="prose prose-invert prose-slate max-w-none text-slate-300 leading-8">
          <h2>The gap Microsoft is describing</h2>
          <p>
            In April 2026, Microsoft published “Securing MCP: A Control Plane for Agent Tool Execution.” The post argues that MCP standardizes an execution surface but does not provide a built-in point where policy is evaluated before a tool call runs.
          </p>
          <p>
            Microsoft also published an internal red-team result: prompt-only safety instructions produced a 26.67% policy-violation rate across its stated benchmark. The lesson is narrow but important. Instructions to the model are not the same thing as an authorization boundary.
          </p>

          <h2>What changes when tools can write</h2>
          <p>
            A read-only search tool and a production deployment tool should not have the same permission model. The decision needs context: which agent is acting, which user delegated the work, which resource is targeted, the exact arguments, and whether the action is reversible.
          </p>
          <p>
            Microsoft calls out risks such as poisoned tool output, untrusted servers, cascading retries and missing circuit breakers. These are execution problems. They need controls at execution time.
          </p>

          <h2>Why this is relevant to RaksHex</h2>
          <p>
            RaksHex is built around the same architectural question: should this proposed action execute? Its useful role is not to tell a model to “be careful.” It is to evaluate delegated authority and policy outside the model, release credentials only when the decision permits the action, and record the decision in the Action Ledger.
          </p>
          <p>
            The market is moving quickly here, which raises the bar. RaksHex needs strong argument-level policy, agent identity, approvals, credential mediation and reproducible enforcement evidence. A generic MCP proxy will not be enough.
          </p>

          <h2>Primary source</h2>
          <ul>
            <li><a href="https://developer.microsoft.com/blog/securing-mcp-a-control-plane-for-agent-tool-execution/" target="_blank" rel="noreferrer">Microsoft for Developers — Securing MCP: A Control Plane for Agent Tool Execution</a></li>
          </ul>

          <div className="not-prose mt-10 rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/5 p-6">
            <p className="text-white font-semibold">RaksHex takeaway</p>
            <p className="mt-2 text-slate-300">MCP makes tool execution portable. The authorization decision still has to live somewhere trustworthy outside the model.</p>
            <Link href="/security" className="inline-block mt-4 text-[#5eead4] hover:underline">Review the RaksHex security model →</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
