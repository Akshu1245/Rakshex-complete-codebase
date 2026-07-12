import Link from "next/link";

export const metadata = {
  title: "Partner Program — DevPulse",
  description:
    "Join the DevPulse partner ecosystem. Technology, Reseller, and Research partnership opportunities for API security and AI governance.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  const partnerTypes = [
    {
      title: "Technology Partners",
      desc: "Integrate DevPulse's AI runtime firewalls, secret scanning, and cost attribution directly into your developer platform, LLM gateway, or DevOps toolkit.",
    },
    {
      title: "Reseller Partners",
      desc: "Distribute DevPulse licenses and compliance auditing packages to your client network, backed by dedicated technical support and co-branded collateral.",
    },
    {
      title: "Research Partners",
      desc: "Collaborate with DevPulse to identify new prompt injection vectors, expand our open-source OWASP AI Top 10 rulesets, and publish joint research.",
    },
  ];

  const whyPartnerPoints = [
    {
      title: "Define the Standard",
      desc: "Collaborate on building robust, public heuristics for the OWASP AI Top 10 security audits.",
    },
    {
      title: "Unlock Mutual Value",
      desc: "Access sandbox testing, API keys, and joint marketing campaigns for integration launches.",
    },
    {
      title: "Direct Founder Access",
      desc: "Work closely with our product and engineering teams to shape our roadmap priorities.",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <nav className="text-sm text-blue-400 mb-6">
          <Link href="/" className="hover:underline">
            ← Back to Home
          </Link>
        </nav>

        {/* Hero */}
        <header className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-950 text-purple-400 border border-purple-900/60 mb-4">
            🤝 Partner Ecosystem
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Partner with DevPulse
          </h1>
          <p className="text-slate-400 text-lg mt-3 max-w-2xl mx-auto">
            We are actively building programs for platform builders, consulting firms, and security
            researchers. Reach out today to start the conversation.
          </p>
          <a
            href="mailto:akshay@devpulse.ai?subject=Partnership%20Inquiry"
            className="inline-block mt-6 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200"
          >
            Contact Partnerships Team
          </a>
        </header>

        {/* Partner Types Grid */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-white mb-8 text-center md:text-left border-b border-slate-900 pb-3">
            Partnership Categories
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {partnerTypes.map((p) => (
              <div
                key={p.title}
                className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">{p.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">{p.desc}</p>
                </div>
                <a
                  href={`mailto:akshay@devpulse.ai?subject=Expressing Interest: ${encodeURIComponent(p.title)}`}
                  className="text-sm text-blue-400 hover:underline mt-auto"
                >
                  Get in touch →
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Why Partner */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-white mb-8 text-center md:text-left border-b border-slate-900 pb-3">
            Why Partner With Us
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {whyPartnerPoints.map((point, idx) => (
              <div key={idx} className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800">
                <h3 className="font-semibold text-lg mb-2 text-white">{point.title}</h3>
                <p className="text-slate-400 text-sm">{point.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500">
          Interested in a specific integration or co-marketing opportunity? Email us — we respond
          within 48 hours.
        </footer>
      </div>
    </div>
  );
}
