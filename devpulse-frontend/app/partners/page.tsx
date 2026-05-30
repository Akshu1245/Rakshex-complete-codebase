import Link from "next/link";

export const metadata = {
  title: "Partner Program — RaksHex",
  description:
    "Join the RaksHex partner ecosystem. Learn about Technology, Reseller, and Research partnership opportunities.",
  alternates: { canonical: "/partners" },
};

export default function PartnersPage() {
  const partnerTypes = [
    {
      title: "Technology Partners",
      desc: "Integrate RaksHex's AI runtime firewalls and cost attribution layers directly into your developer platform, LLM gateway, or DevOps toolkit.",
    },
    {
      title: "Reseller Partners",
      desc: "Distribute RaksHex licenses and compliance auditing packages to your client network, backed by dedicated technical support and co-branded collateral.",
    },
    {
      title: "Research Partners",
      desc: "Collaborate with RaksHex to identify new prompt injection vectors and expand our open-source OWASP AI Top 10 rulesets.",
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
            Partnership Program — Coming Soon
          </h1>
          <p className="text-slate-400 text-lg mt-3 max-w-2xl mx-auto">
            We are designing programs for platform builders, consulting firms, and security
            researchers to advance AI runtime governance together.
          </p>
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
                  href={`mailto:akshay@rakshex.in?subject=Expressing Interest: ${encodeURIComponent(p.title)}`}
                  className="block text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors"
                >
                  Express Interest
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Why Partner with RaksHex Section */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-white mb-8 text-center md:text-left border-b border-slate-900 pb-3">
            Why Partner with RaksHex
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {whyPartnerPoints.map((point, index) => (
              <div key={index} className="p-5 border border-slate-900 rounded-xl bg-slate-950/25">
                <span className="text-xs font-bold text-blue-400 block mb-2 font-mono">
                  0{index + 1}.
                </span>
                <h4 className="font-bold text-white text-sm mb-2">{point.title}</h4>
                <p className="text-slate-400 text-xs leading-relaxed">{point.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Direct Contact Callout */}
        <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Have other partnership ideas?</h2>
          <p className="text-slate-400 text-xs mb-4">
            Email Akshay directly and we will set up a call within 24 hours.
          </p>
          <a
            href="mailto:akshay@rakshex.in"
            className="text-blue-400 hover:underline font-semibold text-sm"
          >
            akshay@rakshex.in
          </a>
        </div>
      </div>
    </div>
  );
}
