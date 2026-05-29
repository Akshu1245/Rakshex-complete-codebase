import Link from "next/link";

export const metadata = {
  title: "About — Rakshex by Rashi Technologies",
  description:
    "Meet the team behind Rakshex. Built in Bengaluru, India with 4 patents. Our mission: make AI governance accessible to every developer.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8 selection:bg-teal-accent selection:text-black">
      {/* Hero */}
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 font-manrope">
          Built by Developers, for Developers
        </h1>
        <p className="text-neutral-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Rakshex was born from a simple observation: every company shipping AI to production has
          three invisible risks — security holes, runaway costs, and compliance gaps. We built the
          platform we wished existed.
        </p>
      </div>

      {/* Mission */}
      <div className="bg-[#141414]/50 border-y border-neutral-900 py-16 my-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center font-manrope">Our Mission</h2>
          <p className="text-neutral-300 text-lg leading-relaxed text-center">
            Make AI governance accessible to every developer, not just Fortune 500 security teams.
            We believe securing AI agents should be as easy as running{" "}
            <code className="bg-[#141414] border border-neutral-800 px-2 py-1 rounded text-sm text-teal-accent">
              npm install
            </code>
            .
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "4", label: "Patents Filed" },
            { value: "478+", label: "Server Tests" },
            { value: "37", label: "API Routers" },
            { value: "18", label: "DB Migrations" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-teal-accent">{s.value}</div>
              <div className="text-neutral-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Founder */}
      <div className="max-w-4xl mx-auto py-16">
        <h2 className="text-2xl font-bold mb-10 text-center font-manrope">Team</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-[#141414] rounded-xl p-8 border border-neutral-850 hover:border-neutral-800 transition-all">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-accent to-teal-accent/80 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 text-white font-mono">
                AK
              </div>
              <div>
                <h3 className="text-xl font-bold">Akshay Kammar</h3>
                <p className="text-teal-accent text-sm mb-2 font-mono">Co-Founder & CEO</p>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Co-inventor on 4 filed patents. Previously built internal security tools and
                  orchestration layers. Computer Science from NHCE, Bengaluru. Believes AI security
                  should be default, not an afterthought.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] rounded-xl p-8 border border-neutral-850 hover:border-neutral-800 transition-all">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-accent to-teal-accent/80 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 text-white font-mono">
                AN
              </div>
              <div>
                <h3 className="text-xl font-bold">Anushree</h3>
                <p className="text-teal-accent text-sm mb-2 font-mono">Co-Founder & CTO</p>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Co-inventor on patents NHCE/DEV/2026/003 and NHCE/DEV/2026/004. Specialist in
                  runtime AI model auditing and compliance systems. Computer Science from NHCE,
                  Bengaluru.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="max-w-4xl mx-auto py-16 text-center">
        <h2 className="text-2xl font-bold mb-4 font-manrope">Built in India</h2>
        <p className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Headquartered in Bengaluru, Karnataka — the Silicon Valley of India. Building for the
          world from day one.
        </p>
      </div>

      {/* Investors / Backing */}
      <div className="bg-[#141414]/50 border-t border-neutral-900 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4 font-manrope">Investor Relations</h2>
          <p className="text-neutral-400 mb-6 max-w-2xl mx-auto leading-relaxed">
            Backed by 4 provisional patents and a growing waitlist. If you&apos;re an investor
            interested in AI security infrastructure, reach out at akshay@rakshex.in
          </p>
          <Link
            href="mailto:akshay@rakshex.in"
            className="inline-block bg-teal-accent hover:bg-[#0D9488] text-white font-bold px-6 py-3 rounded-lg transition-colors font-mono"
          >
            Contact Co-Founders →
          </Link>
        </div>
      </div>
    </div>
  );
}
