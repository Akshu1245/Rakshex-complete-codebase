import Link from "next/link";

export const metadata = {
  title: "RaksHex Research Notes",
  description: "Practical notes on AI agent authorization, MCP governance, credential mediation, runtime cost controls, and evidence-first security.",
  alternates: { canonical: "https://www.rakshex.in/blog" },
};

const POSTS = [
  { href: "/blog/agent-authorization-is-not-api-key-validation", date: "Sep 2, 2026", tag: "Agent security", title: "A valid API key does not mean an AI agent is authorized", summary: "Why credential validity and action-level authority are different controls, and where an agent firewall fits." },
  { href: "/blog/mcp-tool-governance-before-production", date: "Sep 2, 2026", tag: "MCP", title: "Before connecting MCP tools to production agents: a governance checklist", summary: "A practical checklist for tool inventory, least privilege, authorization boundaries, logging, and high-impact actions." },
  { href: "/blog/ai-agent-cost-guardrails-before-runaway-spend", date: "Sep 2, 2026", tag: "Cost governance", title: "Cost controls for autonomous agents should be runtime controls", summary: "Budget dashboards explain spend after it happens. Agentic systems also need limits at the action and request path." },
  { href: "/blog/ai-agent-api-security-blind-spot", date: "Research note", tag: "Architecture", title: "The AI-agent API security blind spot", summary: "Existing RaksHex research on the gap between API access and safe agent execution." },
  { href: "/blog/prompt-injection-production-attack-patterns", date: "Research note", tag: "Prompt injection", title: "Prompt injection patterns in production systems", summary: "Threat-model notes for systems where model output can trigger external actions." },
];

export default function BlogIndex() {
  return <main className="min-h-screen bg-transparent px-5 pb-20 pt-32 text-white sm:px-6 xl:px-8"><div className="mx-auto max-w-5xl">
    <p className="text-sm font-semibold text-[#14B8A6]">RaksHex Research Notes</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Useful engineering notes, not launch spam.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-400">We publish threat-model reasoning, implementation lessons, and current public evidence around AI action governance. Claims are scoped to what can be demonstrated; we avoid invented customers, guaranteed savings, or certification language.</p>
    <div className="mt-10 grid gap-4">{POSTS.map((post) => <Link key={post.href} href={post.href} className="group rounded-xl border border-white/[0.09] bg-black/25 p-6 no-underline hover:border-[#14B8A6]/35"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-[#14B8A6]/10 px-2 py-1 text-[#8FE3D8]">{post.tag}</span><span className="text-neutral-600">{post.date}</span></div><h2 className="mt-3 text-xl font-semibold text-white group-hover:text-[#8FE3D8]">{post.title}</h2><p className="mt-2 text-sm leading-6 text-neutral-400">{post.summary}</p></Link>)}</div>
    <div className="mt-10 rounded-xl border border-[#14B8A6]/20 bg-[#14B8A6]/[0.05] p-6"><h2 className="text-lg font-semibold">Building agents in production?</h2><p className="mt-2 text-sm leading-6 text-neutral-400">Join the verified private-beta waitlist. Personal email addresses are welcome; production fit matters more than company domain.</p><Link href="/waitlist?utm_source=blog&utm_medium=owned&utm_campaign=research-notes" className="mt-4 inline-flex rounded-md bg-[#14B8A6] px-4 py-2.5 text-sm font-semibold text-white">Join verified waitlist</Link></div>
  </div></main>;
}
