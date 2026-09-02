import Link from "next/link";

export const metadata = {
  title: "Google Cloud Is Treating AI Agents as First-Class Identities",
  description:
    "Google Cloud's August 2026 MCP guidance recommends dedicated agent identities and least privilege. What that means for AI action control.",
  alternates: { canonical: "/blog/google-cloud-mcp-agent-identity-2026" },
};

export default function GoogleMcpIdentityPost() {
  return (
    <article className="min-h-screen bg-transparent text-slate-100 px-6 pt-28 pb-20">
      <div className="max-w-3xl mx-auto">
        <Link href="/blog" className="text-sm text-[#14B8A6] hover:underline">← Back to Blog</Link>
        <header className="mt-6 mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[#14B8A6] mb-3">Agent identity · 1 September 2026</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Google Cloud is treating AI agents as first-class identities.
          </h1>
          <p className="mt-5 text-lg text-slate-300 leading-8">
            Google Cloud's latest MCP guidance recommends separate agent or workload identities in production and minimum necessary permissions. That is a shift from treating an agent as a feature running under a human's broad credentials.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 md:p-8 mb-10 overflow-hidden">
          <svg viewBox="0 0 900 390" className="w-full h-auto" role="img" aria-label="Dedicated agent identity with least privilege controlling access to MCP tools">
            <rect width="900" height="390" rx="24" fill="#07111b" />
            <g fontFamily="sans-serif">
              <circle cx="150" cy="195" r="70" fill="#111827" stroke="#14B8A6" />
              <text x="150" y="188" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">Agent</text>
              <text x="150" y="216" textAnchor="middle" fill="#94a3b8" fontSize="13">own identity</text>
              <path d="M220 195 H335" stroke="#14B8A6" strokeWidth="4" markerEnd="url(#g)" />
              <rect x="335" y="105" width="230" height="180" rx="18" fill="#0f172a" stroke="#334155" />
              <text x="450" y="143" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="700">Least privilege</text>
              <text x="450" y="178" textAnchor="middle" fill="#cbd5e1" fontSize="13">specific roles</text>
              <text x="450" y="207" textAnchor="middle" fill="#cbd5e1" fontSize="13">specific resources</text>
              <text x="450" y="236" textAnchor="middle" fill="#cbd5e1" fontSize="13">read/write separation</text>
              <path d="M565 195 H680" stroke="#14B8A6" strokeWidth="4" markerEnd="url(#g)" />
              <rect x="680" y="125" width="165" height="140" rx="18" fill="#111827" stroke="#334155" />
              <text x="762" y="167" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">MCP tools</text>
              <text x="762" y="198" textAnchor="middle" fill="#94a3b8" fontSize="13">bounded access</text>
              <text x="762" y="228" textAnchor="middle" fill="#5eead4" fontSize="13">auditable</text>
              <defs><marker id="g" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#14B8A6" /></marker></defs>
            </g>
          </svg>
        </div>

        <div className="prose prose-invert prose-slate max-w-none text-slate-300 leading-8">
          <h2>What Google is recommending</h2>
          <p>
            Google Cloud's MCP security documentation says agent-only operation is vulnerable to prompt injection, insecure tool chaining and naive error handling. Its production authentication guidance recommends a separate agent or workload identity instead of reusing a human identity.
          </p>
          <p>
            Google also recommends granting only the minimum permissions required and using controls that prevent read-write MCP access to important resources where appropriate. Its newer MCP server documentation combines identity, IAM policies and Model Armor around tool calls.
          </p>

          <h2>Why identity changes the security model</h2>
          <p>
            If an agent runs under an administrator's credentials, the model inherits an administrator-sized blast radius. A prompt injection can become an authorization problem because the agent already holds enough authority to perform the harmful action.
          </p>
          <p>
            Dedicated identity makes policy enforceable. The system can distinguish one coding agent from another, limit resources, revoke access, separate read and write duties, and attribute actions to the workload that actually performed them.
          </p>

          <h2>Where RaksHex fits</h2>
          <p>
            RaksHex should treat identity as the first input to every consequential decision. The useful chain is agent identity → delegated authority → semantic action and arguments → policy → credential mediation → execution → Action Ledger.
          </p>
          <p>
            RaksHex should not claim that it replaces cloud IAM. Cloud IAM decides what a principal can access inside that cloud. RaksHex's opportunity is to add action-level authorization and delegated-agent context across tools and providers before a credential or tool call is released.
          </p>

          <h2>Primary sources</h2>
          <ul>
            <li><a href="https://docs.cloud.google.com/mcp/ai-security-safety" target="_blank" rel="noreferrer">Google Cloud — MCP AI security and safety</a></li>
            <li><a href="https://docs.cloud.google.com/mcp/authenticate-mcp" target="_blank" rel="noreferrer">Google Cloud — Authenticate to MCP servers</a></li>
            <li><a href="https://docs.cloud.google.com/mcp/overview" target="_blank" rel="noreferrer">Google Cloud — MCP servers overview</a></li>
          </ul>

          <div className="not-prose mt-10 rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/5 p-6">
            <p className="text-white font-semibold">RaksHex takeaway</p>
            <p className="mt-2 text-slate-300">A trustworthy action decision starts with a trustworthy identity. Broad human credentials are a poor default for autonomous software.</p>
            <Link href="/docs" className="inline-block mt-4 text-[#5eead4] hover:underline">Read the RaksHex docs →</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
