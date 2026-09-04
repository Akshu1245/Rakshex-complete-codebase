import Link from "next/link";

export const metadata = {
  title: "A stolen METR API key consumed credits worth about $600,000 — RaksHex",
  description:
    "A source-backed analysis of METR's March 2026 API-key theft, three weeks of unauthorized inference usage, and the credential, spend and monitoring controls that matter.",
  alternates: { canonical: "https://rakshex.in/blog/metr-stolen-api-key-600k-credits-2026" },
};

export default function Article() {
  return (
    <main className="min-h-screen bg-transparent text-white pt-28 pb-20 px-6">
      <article className="max-w-3xl mx-auto">
        <Link href="/incidents" className="text-sm text-[#5eead4] hover:underline">← RaksHex Incident Intelligence</Link>

        <div className="mt-8 mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[#5eead4] mb-3">Credentials · Cost & API bills · 4 Sep 2026</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Attackers stole a METR model API key and consumed credits worth about $600,000.
          </h1>
          <p className="mt-5 text-slate-400 text-lg leading-8">
            The important part is not the headline number. METR's own post explains a chain that security and platform teams can act on: a fail-open public agent dashboard, a reusable model credential, no spend ceiling, incomplete usage visibility, and three weeks before the abnormal traffic was identified.
          </p>
        </div>

        <section className="space-y-6 text-slate-300 leading-8">
          <h2 className="text-2xl font-semibold text-white">What METR disclosed</h2>
          <p>
            METR published a security update on August 31, 2026 describing two incidents from earlier in the year. In the first, a researcher ran agents on a personal EC2 instance that was intentionally internet-accessible behind Google authentication. According to METR, the vibe-coded application contained a fail-open vulnerability that silently disabled authentication and exposed the service publicly for several days.
          </p>
          <p>
            METR says an attacker found the instance, prompted an agent to reveal its model-provider API key, added an SSH key for persistence, and then used the stolen credential for roughly three weeks. The consumed public-model credits would have been worth approximately US$600,000, although METR says the model developer had granted those credits for free. This was therefore not a $600,000 invoice to METR.
          </p>

          <h2 className="text-2xl font-semibold text-white">Why the abuse lasted so long</h2>
          <p>
            METR's post is unusually useful because it spells out why the usage did not immediately look malicious. The organization routinely runs token-heavy evaluations, its internal dashboard did not expose all rate-limited requests to users at the time, and the affected credits were free, so there was no natural spend ceiling. METR also says there was no way at the time to place a spending limit on keys like the stolen one.
          </p>
          <p>
            That combination matters. High baseline usage can hide abuse, dashboards can omit the very signals that distinguish normal from abnormal traffic, and a credential that remains valid can continue exercising authority even after the original workload has been compromised.
          </p>

          <div className="rounded-2xl border border-[#1A1F2E] bg-black/30 p-6 my-8">
            <svg viewBox="0 0 820 220" role="img" aria-label="Credential and spend control boundary" className="w-full h-auto">
              <rect x="10" y="70" width="155" height="78" rx="14" fill="none" stroke="currentColor" opacity=".35" />
              <text x="87" y="101" textAnchor="middle" fill="currentColor" fontSize="14">Agent workload</text>
              <text x="87" y="124" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">credential request</text>

              <path d="M175 109h90" stroke="currentColor" opacity=".35" />
              <path d="m255 103 12 6-12 6" fill="currentColor" opacity=".5" />

              <rect x="275" y="45" width="270" height="128" rx="14" fill="none" stroke="currentColor" opacity=".55" />
              <text x="410" y="78" textAnchor="middle" fill="currentColor" fontSize="14">Execution policy boundary</text>
              <text x="410" y="102" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">identity + credential scope</text>
              <text x="410" y="124" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">budget + anomaly state</text>
              <text x="410" y="146" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">ALLOW / DENY / APPROVAL / KILL</text>

              <path d="M555 109h90" stroke="currentColor" opacity=".35" />
              <path d="m635 103 12 6-12 6" fill="currentColor" opacity=".5" />

              <rect x="655" y="70" width="155" height="78" rx="14" fill="none" stroke="currentColor" opacity=".35" />
              <text x="732" y="101" textAnchor="middle" fill="currentColor" fontSize="14">Model provider</text>
              <text x="732" y="124" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".65">paid / metered call</text>
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-white">Where RaksHex is relevant</h2>
          <p>
            For traffic and credentials actually mediated through RaksHex, this incident maps to four controls: workload or agent identity, scoped credential release, deterministic budget policy, and anomaly-triggered shutdown. The objective is to make continued use of authority conditional on policy rather than on possession of a long-lived key.
          </p>
          <p>
            RaksHex's Action Ledger is also relevant to attribution. A useful audit trail should record which workload requested a credential-backed action, which policy allowed or denied it, the budget state at decision time, and whether a kill switch or approval boundary changed the outcome.
          </p>

          <h2 className="text-2xl font-semibold text-white">What RaksHex would not have solved</h2>
          <p>
            This incident began with a fail-open authentication bug on a public EC2 application and later included an attacker adding an SSH key. RaksHex is not a replacement for application authentication, secure deployment review, host hardening, endpoint security, network isolation, or provider-side credential controls. If an attacker can bypass the RaksHex enforcement path and use a raw provider credential directly, RaksHex cannot stop those requests.
          </p>
          <p>
            For that reason, the correct RaksHex impact label is <strong className="text-white">Reducible</strong>, not guaranteed Preventable. Credential mediation and spend enforcement could reduce blast radius when the relevant execution path is routed through RaksHex, but they do not erase the underlying infrastructure compromise.
          </p>

          <h2 className="text-2xl font-semibold text-white">What changed afterward</h2>
          <p>
            METR says it revoked the researcher's access, rotated credentials, preserved and wiped affected systems, increased monitoring coverage, added spend alerts where possible, formalized security review for public researcher deployments, reduced credential longevity and permission scopes, and improved logging across API usage and other systems.
          </p>

          <h2 className="text-2xl font-semibold text-white">Primary source</h2>
          <p>
            <a href="https://metr.org/blog/2026-08-31-security-update/" target="_blank" rel="noreferrer" className="text-[#5eead4] underline underline-offset-4">METR — Update on Security, August 31, 2026</a>. The incident description, three-week duration, approximately $600,000 credit value and explanation for delayed detection above come directly from METR's disclosure.
          </p>
        </section>
      </article>
    </main>
  );
}
