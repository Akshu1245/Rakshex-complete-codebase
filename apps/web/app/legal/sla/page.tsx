import Link from "next/link";

export const metadata = {
  title: "Enterprise SLA | RakshEx",
  description:
    "Availability target, support response targets, exclusions, and service credits for paid Enterprise orders.",
  alternates: { canonical: "/legal/sla" },
};

export default function EnterpriseSlaPage() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-300">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Enterprise Service Level Agreement</h1>
        <p className="mt-3 text-sm text-slate-500">Effective 12 July 2026</p>
        <p className="mt-4 text-sm">
          <Link href="/legal" className="text-[#14B8A6] hover:underline">
            Legal center
          </Link>
          {" · "}
          <a href="/legal/rakshex-enterprise-sla.docx" className="text-[#14B8A6] hover:underline">
            Download DOCX
          </a>
        </p>

        <div className="mt-12 space-y-10 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">Applicability</h2>
            <p className="mt-3">
              This SLA applies only when an Order Form expressly incorporates it. Free, trial,
              preview, beta, community, self-hosted, and third-party provider services are excluded
              unless the Order Form says otherwise.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Service commitment</h2>
            <p className="mt-3">
              For the hosted RakshEx control plane, we target{" "}
              <strong className="text-white">99.9%</strong> monthly uptime, excluding scheduled
              maintenance and listed exclusions. Credits are the contractual remedy for SLA failure
              — not a warranty of uninterrupted service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Support response targets</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2 pr-3">Severity</th>
                    <th className="py-2 pr-3">Initial response</th>
                    <th className="py-2">Updates</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-3 text-white">P1</td>
                    <td className="py-2 pr-3">4 hours, 24×7</td>
                    <td className="py-2">Every 4 hours while active</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-3 text-white">P2</td>
                    <td className="py-2 pr-3">1 business day</td>
                    <td className="py-2">Every business day</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-3 text-white">P3</td>
                    <td className="py-2 pr-3">2 business days</td>
                    <td className="py-2">Every 5 business days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-white">P4</td>
                    <td className="py-2 pr-3">5 business days</td>
                    <td className="py-2">At planned review</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-white">Credits and exclusions</h2>
            <p className="mt-3">
              Credits scale from 5% to 25% of the affected monthly fee based on measured uptime.
              Exclusions include customer configuration, third-party AI providers, force majeure,
              and planned maintenance with notice. Full text is in the downloadable DOCX.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
