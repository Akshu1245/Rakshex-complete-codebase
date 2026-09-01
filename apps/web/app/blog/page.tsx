import Link from "next/link";

export const metadata = {
  title: "RaksHex Blog — AI Agent Security, API Cost & Governance",
  description:
    "Source-backed analysis of AI agent incidents, MCP security, API spend controls, runtime authorization and the controls autonomous systems need before they act.",
  alternates: { canonical: "https://rakshex.in/blog" },
};

const posts = [
  {
    href: "/blog/cloudflare-ai-spend-limits-2026",
    date: "1 Sep 2026",
    category: "Cost governance",
    title: "Cloudflare added hard AI spend limits. Cost control is becoming infrastructure.",
    summary:
      "Cloudflare AI Gateway can now block requests when a dollar budget is exhausted. We break down what that means for runaway agent spend and why cost enforcement alone is not enough.",
  },
  {
    href: "/blog/google-cloud-mcp-agent-identity-2026",
    date: "1 Sep 2026",
    category: "Agent identity",
    title: "Google Cloud is treating AI agents as first-class identities.",
    summary:
      "Google's latest MCP guidance recommends dedicated agent identities and least privilege in production. That makes identity part of the agent-action security boundary.",
  },
  {
    href: "/blog/microsoft-mcp-control-plane-2026",
    date: "1 Sep 2026",
    category: "MCP security",
    title: "Microsoft says MCP needs a policy point before tool execution.",
    summary:
      "Microsoft's Agent Governance Toolkit targets a specific gap in MCP: policy is not built into the protocol's execution surface. The authorization decision has to live somewhere else.",
  },
  {
    href: "/blog/replit-agent-production-database-incident",
    date: "Retrospective",
    category: "Agent incident",
    title: "When an AI coding agent deleted a production database during a code freeze.",
    summary:
      "The Replit/SaaStr incident remains a clean example of the difference between telling an agent not to act and technically preventing the action.",
  },
];

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-transparent text-white pt-28 pb-20 px-6 xl:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-12">
          <p className="text-[#14B8A6] text-sm font-medium mb-3">RaksHex Blog</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
            What breaks when AI stops answering and starts acting.
          </h1>
          <p className="text-[#9CA3AF] text-lg leading-relaxed">
            We track consequential AI-agent incidents, API cost controls, MCP security, credential risks and runtime governance. Every article links to its sources and separates what the market proved from what RaksHex can prove today.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-10 items-start">
          <section className="space-y-5" aria-label="Latest RaksHex articles">
            {posts.map((post, index) => (
              <Link
                key={post.href}
                href={post.href}
                className={`block rounded-2xl border p-6 md:p-7 transition-colors ${
                  index === 0
                    ? "border-[#14B8A6]/40 bg-[#14B8A6]/5 hover:bg-[#14B8A6]/10"
                    : "border-[#1A1F2E] bg-black/30 hover:border-[#14B8A6]/30"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                  <span className="text-[#5eead4] font-medium">{post.category}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">{post.date}</span>
                  {index === 0 && (
                    <span className="ml-auto rounded-full border border-[#14B8A6]/30 px-2.5 py-1 text-[#5eead4]">Latest</span>
                  )}
                </div>
                <h2 className="text-2xl font-semibold text-white leading-snug">{post.title}</h2>
                <p className="mt-3 text-slate-400 leading-7">{post.summary}</p>
                <span className="inline-block mt-4 text-sm text-[#5eead4]">Read analysis →</span>
              </Link>
            ))}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6">
              <h2 className="font-semibold text-white mb-3">Editorial rule</h2>
              <p className="text-sm text-slate-400 leading-6">
                No invented incidents, fake customer proof, unsupported savings numbers or vague “industry experts say” filler. Primary sources first; reputable reporting when the event itself is the story.
              </p>
            </div>
            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6">
              <h2 className="font-semibold text-white mb-3">Topics we watch</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  "agent actions",
                  "MCP",
                  "API spend",
                  "credentials",
                  "prompt injection",
                  "least privilege",
                  "kill switches",
                  "audit trails",
                ].map((topic) => (
                  <span key={topic} className="rounded-full border border-slate-800 px-2.5 py-1.5 text-slate-400">{topic}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/5 p-6">
              <h2 className="font-semibold text-white mb-2">What RaksHex is building</h2>
              <p className="text-sm text-slate-400 leading-6 mb-4">
                Pre-execution authorization for consequential agent actions: identity, delegated authority, policy, credential mediation and an Action Ledger.
              </p>
              <Link href="/demo" className="text-sm text-[#5eead4] hover:underline">Open the Agent Firewall demo →</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
