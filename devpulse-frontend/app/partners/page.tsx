import Link from "next/link";

export const metadata = {
  title: "Partner Program — Rakshex",
  description:
    "Join the Rakshex partner ecosystem. Reseller, referral, and integration partner programs for agencies, consultancies, and system integrators.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="text-center py-20 px-4 border-b border-gray-800">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Partner With Us</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Join the Rakshex ecosystem. Whether you are a consultancy, reseller, or technology partner
          — we grow together.
        </p>
      </div>

      <div className="max-w-5xl mx-auto py-16 px-4 space-y-16">
        {/* Partner Types */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Referral Partners",
              desc: "Earn 20% recurring commission for every customer you refer. No minimums. Monthly payouts. Dashboard to track conversions.",
              cta: "Apply as Referral Partner",
            },
            {
              title: "Reseller Partners",
              desc: "White-label Rakshex for your clients. Set your own pricing. Get dedicated support, co-branded materials, and sales training.",
              cta: "Apply as Reseller",
            },
            {
              title: "Integration Partners",
              desc: "Build integrations with Rakshex. Get technical documentation, sandbox access, and co-marketing support.",
              cta: "Apply as Integration Partner",
            },
          ].map((p) => (
            <div
              key={p.title}
              className="bg-gray-800 p-8 rounded-xl border border-gray-700 flex flex-col"
            >
              <h2 className="text-xl font-bold mb-3 text-blue-400">{p.title}</h2>
              <p className="text-gray-400 text-sm leading-relaxed flex-1 mb-6">{p.desc}</p>
              <Link
                href="mailto:partners@rakshex.in"
                className="block text-center bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {p.cta} →
              </Link>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">Partner Benefits</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {[
              { title: "20% Commission", desc: "Recurring for life of account" },
              { title: "Co-Marketing", desc: "Joint case studies and webinars" },
              { title: "Sandbox Access", desc: "Full platform for demos and testing" },
              { title: "Dedicated Support", desc: "Slack channel + quarterly reviews" },
            ].map((b) => (
              <div key={b.title} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h3 className="font-bold text-lg mb-1">{b.title}</h3>
                <p className="text-gray-400 text-sm">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 text-center">
          <h2 className="text-xl font-bold mb-2">Ready to partner?</h2>
          <p className="text-gray-400 mb-4">Email us and we will set up a call within 24 hours.</p>
          <Link
            href="mailto:partners@rakshex.in"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            partners@rakshex.in
          </Link>
        </div>
      </div>
    </div>
  );
}
