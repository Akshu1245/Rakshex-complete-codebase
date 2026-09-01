import Link from "next/link";

export const metadata = {
  title: "A forgotten Google Cloud API key led to an $18,000+ bill — RaksHex",
  description: "A source-backed analysis of the April 2026 Google Cloud API-key abuse incident and the controls that could reduce credential and spend blast radius.",
  alternates: { canonical: "https://rakshex.in/blog/google-cloud-api-key-18000-bill-2026" },
};

export default function Article() {
  return (
    <main className="min-h-screen bg-transparent text-white pt-28 pb-20 px-6">
      <article className="max-w-3xl mx-auto">
        <Link href="/incidents" className="text-sm text-[#5eead4] hover:underline">← RaksHex Incident Intelligence</Link>
        <div className="mt-8 mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[#5eead4] mb-3">Credentials · Cost & API bills · RH-2026-0005</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">A forgotten Google Cloud API key was abused for 60,000+ requests and an $18,000+ bill.</h1>
          <p className="mt-5 text-slate-400 text-lg leading-8">The useful lesson is not that cloud APIs are dangerous. It is that a reusable credential, a permissive execution path and a budget that is not enforced as authorization can combine into a very expensive failure.</p>
        </div>

        <section className="space-y-6 text-slate-300 leading-8">
          <h2 className="text-2xl font-semibold text-white">What happened</h2>
          <p>In April 2026, Tom's Hardware reported the case of Australian AI consultant Jesse Davies, who discovered a Google Cloud bill of A$25,672.86, about US$18,391 at the time. The report says a publicly reachable Cloud Run service still exposed an API key through an environment variable. An attacker used the path for more than 60,000 requests.</p>
          <p>The report also says the customer had configured a much smaller budget and spending cap, but the abusive traffic still accumulated charges before the issue was resolved. Google ultimately waived the charges.</p>

          <h2 className="text-2xl font-semibold text-white">Why this matters</h2>
          <p>A budget notification is not the same thing as a deny decision. If a workload can continue presenting a long-lived credential after its intended spend or authority is exceeded, the financial control exists outside the execution path.</p>

          <div className="rounded-2xl border border-[#1A1F2E] bg-black/30 p-6 my-8">
            <svg viewBox="0 0 760 180" role="img" aria-label="Credential abuse control path" className="w-full h-auto">
              <rect x="10" y="55" width="150" height="70" rx="14" fill="none" stroke="currentColor" opacity=".35"/><text x="85" y="85" textAnchor="middle" fill="currentColor" fontSize="14">Workload / attacker</text><text x="85" y="106" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">reuses exposed key</text>
              <path d="M170 90h100" stroke="currentColor" opacity=".35"/><path d="m260 84 12 6-12 6" fill="currentColor" opacity=".5"/>
              <rect x="280" y="35" width="200" height="110" rx="14" fill="none" stroke="currentColor" opacity=".55"/><text x="380" y="72" textAnchor="middle" fill="currentColor" fontSize="14">RaksHex policy boundary</text><text x="380" y="96" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">identity + spend + credential</text><text x="380" y="119" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">ALLOW / DENY / APPROVAL</text>
              <path d="M490 90h100" stroke="currentColor" opacity=".35"/><path d="m580 84 12 6-12 6" fill="currentColor" opacity=".5"/>
              <rect x="600" y="55" width="150" height="70" rx="14" fill="none" stroke="currentColor" opacity=".35"/><text x="675" y="85" textAnchor="middle" fill="currentColor" fontSize="14">Paid API</text><text x="675" y="106" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">request executes</text>
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-white">Where RaksHex fits</h2>
          <p>For traffic routed through RaksHex, the useful controls are credential mediation, workload identity, a deterministic spend policy and a kill switch. A compromised static provider key that bypasses RaksHex is outside that boundary, so it would be wrong to claim the product automatically eliminates credential theft.</p>
          <p>That is why this incident is labelled <strong className="text-white">Reducible</strong>, not guaranteed Preventable. RaksHex can reduce blast radius when the credential and paid execution path are mediated through it; it cannot control traffic that never reaches its enforcement point.</p>

          <h2 className="text-2xl font-semibold text-white">Source</h2>
          <p><a href="https://www.tomshardware.com/tech-industry/artificial-intelligence/google-cloud-customer-wakes-up-to-usd18-000-bill-despite-usd7-budget-thanks-to-forgotten-public-api-key-attacker-put-in-60-000-requests-and-blasted-through-usd1-400-spending-cap" target="_blank" rel="noreferrer" className="text-[#5eead4] underline underline-offset-4">Tom's Hardware, April 2026</a>. The financial figures and request count above come from that report.</p>
        </section>
      </article>
    </main>
  );
}
