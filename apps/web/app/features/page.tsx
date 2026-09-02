import Link from "next/link";

export const metadata = { title: "RaksHex Features", description: "Runtime authorization, credential mediation, MCP governance, cost controls, audit evidence, and agent-security workflows." };

const FEATURES = [
  ["Runtime authorization", "Evaluate consequential agent actions against policy before execution rather than relying on a valid credential alone."],
  ["Credential mediation", "Keep high-value credentials behind a controlled path so agents receive only the authority required for an approved action."],
  ["MCP governance", "Inventory MCP servers and tools, review risky capabilities, and retain invocation evidence."],
  ["Cost guardrails", "Track supported AI usage and enforce budget or policy thresholds on instrumented paths."],
  ["Action ledger", "Preserve decision and execution evidence for investigations, reviews, and internal governance."],
  ["Security workflows", "Surface prompt-injection, secret, API, and policy findings with explicit product-scope language."],
];

export default function FeaturesPage() {
  return <main className="min-h-screen bg-transparent px-5 pb-20 pt-32 text-white"><div className="mx-auto max-w-6xl"><p className="text-sm font-semibold text-[#14B8A6]">Current private-beta surface</p><h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Control what AI agents are allowed to do.</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-400">RaksHex focuses on authorization and evidence around consequential agent actions. Availability depends on the integration path and beta scope; we do not present unshipped connectors or certifications as completed.</p><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([title,desc]) => <article key={title} className="rounded-xl border border-white/10 bg-black/25 p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-neutral-400">{desc}</p></article>)}</div><div className="mt-10 flex flex-wrap gap-3"><Link href="/demo" className="rounded-md border border-white/10 px-5 py-3 text-sm font-semibold text-white">Try public demo</Link><Link href="/waitlist" className="rounded-md bg-[#14B8A6] px-5 py-3 text-sm font-semibold text-white">Join verified beta waitlist</Link></div></div></main>;
}
