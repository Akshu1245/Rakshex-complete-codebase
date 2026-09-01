import Link from "next/link";

export const metadata = {
  title: "Claude Code approval fatigue shows why agent permissions need context — RaksHex",
  description: "A source-backed analysis of Anthropic's Claude Code auto mode, approval fatigue, and why consequential actions need contextual authorization.",
  alternates: { canonical: "https://rakshex.in/blog/claude-code-approval-fatigue-action-policy-2026" },
};

export default function Article() {
  return (
    <main className="min-h-screen bg-transparent text-white pt-28 pb-20 px-6">
      <article className="max-w-3xl mx-auto">
        <Link href="/incidents" className="text-sm text-[#5eead4] hover:underline">← RaksHex Incident Intelligence</Link>
        <div className="mt-8 mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[#5eead4] mb-3">Production actions · Agent security · RH-2026-0010</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">Claude Code users approve 93% of permission prompts. That is a control-design problem.</h1>
          <p className="mt-5 text-slate-400 text-lg leading-8">Anthropic's March 2026 engineering write-up on Claude Code auto mode exposes a familiar security tension: asking for confirmation on everything trains users to stop treating confirmation as meaningful.</p>
        </div>

        <section className="space-y-6 text-slate-300 leading-8">
          <h2 className="text-2xl font-semibold text-white">What Anthropic reported</h2>
          <p>Anthropic says Claude Code users approve 93% of permission prompts. The company describes the resulting approval-fatigue problem and the tradeoff between sandboxing, manual approvals and the unsafe <code className="text-slate-200">--dangerously-skip-permissions</code> option.</p>
          <p>Its response was auto mode: classifiers decide whether some requested actions can proceed without a manual permission prompt. Anthropic is explicit that the approach improves the tradeoff but does not eliminate risk.</p>

          <h2 className="text-2xl font-semibold text-white">Why this matters beyond one coding tool</h2>
          <p>A permission popup is only useful when it appears at the right boundary and gives the reviewer enough context to make a real decision. If every read, write and shell command looks equally urgent, approval becomes muscle memory.</p>
          <p>The better policy question is narrower: <em>who is acting, on whose authority, against which resource, with which arguments, in which environment, and how consequential is the action?</em></p>

          <div className="rounded-2xl border border-[#1A1F2E] bg-black/30 p-6 my-8">
            <svg viewBox="0 0 760 200" role="img" aria-label="Contextual approval workflow" className="w-full h-auto">
              <rect x="10" y="65" width="145" height="70" rx="14" fill="none" stroke="currentColor" opacity=".35"/><text x="82" y="94" textAnchor="middle" fill="currentColor" fontSize="14">Agent action</text><text x="82" y="115" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">deploy / delete / pay</text>
              <path d="M165 100h85" stroke="currentColor" opacity=".35"/><path d="m240 94 12 6-12 6" fill="currentColor" opacity=".5"/>
              <rect x="260" y="35" width="220" height="130" rx="14" fill="none" stroke="currentColor" opacity=".55"/><text x="370" y="70" textAnchor="middle" fill="currentColor" fontSize="14">Contextual policy</text><text x="370" y="94" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">identity + authority + resource</text><text x="370" y="116" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">arguments + environment + risk</text><text x="370" y="141" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">ALLOW / DENY / APPROVAL</text>
              <path d="M490 100h85" stroke="currentColor" opacity=".35"/><path d="m565 94 12 6-12 6" fill="currentColor" opacity=".5"/>
              <rect x="585" y="65" width="165" height="70" rx="14" fill="none" stroke="currentColor" opacity=".35"/><text x="667" y="94" textAnchor="middle" fill="currentColor" fontSize="14">Human only when</text><text x="667" y="115" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">the risk requires it</text>
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-white">Where RaksHex fits</h2>
          <p>RaksHex's relevant design principle is semantic, pre-execution authorization. Routine low-risk actions can be allowed by policy, obviously prohibited actions can be denied, and consequential actions can require approval with the action, arguments, identity and delegated authority attached.</p>
          <p>That does not mean RaksHex replaces Claude Code's own sandboxing or Anthropic's safety classifiers. It sits at a different boundary: deciding whether a consequential action routed through RaksHex should execute.</p>

          <h2 className="text-2xl font-semibold text-white">Source</h2>
          <p><a href="https://www.anthropic.com/engineering/claude-code-auto-mode" target="_blank" rel="noreferrer" className="text-[#5eead4] underline underline-offset-4">Anthropic Engineering, March 25, 2026</a>. The 93% approval figure and discussion of sandboxing, permission bypass and auto mode come from Anthropic's article.</p>
        </section>
      </article>
    </main>
  );
}
