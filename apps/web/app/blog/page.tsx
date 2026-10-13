import Link from "next/link";

export const metadata = {
  title: "RaksHex Blog — AI Agent Security, API Cost & Governance",
  description:
    "Source-backed analysis of AI agent incidents, MCP security, API spend controls, runtime authorization and the controls autonomous systems need before they act.",
  alternates: { canonical: "https://rakshex.in/blog" },
};

const posts = [
  {
    href: "/blog/metr-stolen-api-key-600k-credits-2026",
    date: "4 Sep 2026",
    category: "Credentials & cost",
    title: "Attackers stole a METR model API key and consumed credits worth about $600,000.",
    summary:
      "METR's own disclosure connects a fail-open public agent dashboard, reusable credentials, missing spend ceilings and weak usage visibility. We map what RaksHex could reduce without pretending it replaces infrastructure security.",
  },
  {
    href: "/blog/google-cloud-api-key-18000-bill-2026",
    date: "1 Sep 2026",
    category: "Credentials & cost",
    title: "A forgotten Google Cloud API key was abused for 60,000+ requests and an $18,000+ bill.",
    summary:
      "A reusable credential, an exposed execution path and a budget that did not act as authorization combined into a costly failure. We separate what RaksHex could reduce from what remains outside its path.",
  },
  {
    href: "/blog/claude-code-approval-fatigue-action-policy-2026",
    date: "1 Sep 2026",
    category: "Agent permissions",
    title: "Claude Code users approve 93% of permission prompts. That is a control-design problem.",
    summary:
      "Anthropic's auto-mode write-up shows why asking humans to approve everything eventually weakens the approval itself. Contextual action policy is a different control boundary.",
  },
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

const audienceMenus = ["Solo Developer", "Developer Teams", "Companies & Startups", "Enterprise / Big MNC"];

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-transparent text-white pt-28 pb-20 px-6 xl:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-4xl mb-10">
          <p className="text-[#14B8A6] text-sm font-medium mb-3">RaksHex Research & Analysis</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">The long-form layer behind RaksHex Incident Intelligence.</h1>
          <p className="text-[#9CA3AF] text-lg leading-relaxed">The incident database is the evidence layer. This blog is where we unpack the architecture, economics and security lessons behind those records without turning every event into a product pitch.</p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link href="/incidents" className="rounded-lg bg-[#14B8A6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0D9488] transition-colors">Open Incident Intelligence →</Link>
            <Link href="/demo" className="rounded-lg border border-[#1A1F2E] px-5 py-3 text-sm font-semibold text-white hover:border-[#14B8A6]/50 transition-colors">Open Agent Firewall demo</Link>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {audienceMenus.map((audience) => (
            <Link key={audience} href="/incidents" className="rounded-xl border border-[#1A1F2E] bg-black/35 p-4 text-sm text-slate-300 hover:border-[#14B8A6]/40 transition-colors">{audience}</Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-10 items-start">
          <section className="space-y-5" aria-label="Latest RaksHex articles">
            {posts.map((post, index) => (
              <Link key={post.href} href={post.href} className={`block rounded-2xl border p-6 md:p-7 transition-colors ${index === 0 ? "border-[#14B8A6]/40 bg-[#14B8A6]/5 hover:bg-[#14B8A6]/10" : "border-[#1A1F2E] bg-black/30 hover:border-[#14B8A6]/30"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs mb-3"><span className="text-[#5eead4] font-medium">{post.category}</span><span className="text-slate-600">·</span><span className="text-slate-500">{post.date}</span>{index === 0 && <span className="ml-auto rounded-full border border-[#14B8A6]/30 px-2.5 py-1 text-[#5eead4]">Latest</span>}</div>
                <h2 className="text-2xl font-semibold text-white leading-snug">{post.title}</h2>
                <p className="mt-3 text-slate-400 leading-7">{post.summary}</p>
                <span className="inline-block mt-4 text-sm text-[#5eead4]">Read analysis →</span>
              </Link>
            ))}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/5 p-6"><h2 className="font-semibold text-white mb-2">Flagship: Incident Intelligence</h2><p className="text-sm text-slate-400 leading-6 mb-4">Structured records by audience, severity, root cause, missing control and RaksHex impact: Preventable, Reducible, Detectable or Outside current scope.</p><Link href="/incidents" className="text-sm text-[#5eead4] hover:underline">Browse incidents →</Link></div>
            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6"><h2 className="font-semibold text-white mb-3">Editorial rule</h2><p className="text-sm text-slate-400 leading-6">No invented incidents, fake customer proof, unsupported savings numbers or vague “industry experts say” filler. Primary sources first; reputable reporting when the event itself is the story.</p></div>
            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6"><h2 className="font-semibold text-white mb-3">Topics we watch</h2><div className="flex flex-wrap gap-2 text-xs">{["agent actions", "MCP", "API spend", "credentials", "prompt injection", "least privilege", "kill switches", "audit trails"].map((topic) => <span key={topic} className="rounded-full border border-slate-800 px-2.5 py-1.5 text-slate-400">{topic}</span>)}</div></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
