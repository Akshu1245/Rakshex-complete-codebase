import Link from "next/link";

export const metadata = {
  title: "About — Rakshex by Rashi Technologies",
  description:
    "Meet the team behind Rakshex. Built in Bengaluru, India with 4 patents. Our mission: make AI governance accessible to every developer.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto py-20 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Built by Developers, for Developers</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Rakshex was born from a simple observation: every company shipping AI to production has
          three invisible risks — security holes, runaway costs, and compliance gaps. We built the
          platform we wished existed.
        </p>
      </div>

      {/* Mission */}
      <div className="bg-gray-800/50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6 text-center">Our Mission</h2>
          <p className="text-gray-300 text-lg leading-relaxed text-center">
            Make AI governance accessible to every developer, not just Fortune 500 security teams.
            We believe securing AI agents should be as easy as running{" "}
            <code className="bg-gray-800 px-2 py-1 rounded text-sm">npm install</code>.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-5xl mx-auto py-16 px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "4", label: "Patents Filed" },
            { value: "478+", label: "Server Tests" },
            { value: "37", label: "API Routers" },
            { value: "18", label: "DB Migrations" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-blue-400">{s.value}</div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Founder */}
      <div className="max-w-4xl mx-auto py-16 px-4">
        <h2 className="text-2xl font-bold mb-10 text-center">Team</h2>
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 max-w-xl mx-auto">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold shrink-0">
              AK
            </div>
            <div>
              <h3 className="text-xl font-bold">Akshay Kammar</h3>
              <p className="text-blue-400 text-sm mb-2">Founder & CEO</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Built Rakshex solo over 4 months. 4 patents filed. Previously built internal
                security tools. Computer Science from NHCE, Bengaluru. Believes AI security should
                be default, not an afterthought.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Built in India</h2>
        <p className="text-gray-400 max-w-xl mx-auto">
          Headquartered in Bengaluru, Karnataka — the Silicon Valley of India. Building for the
          world from day one.
        </p>
      </div>

      {/* Investors / Backing */}
      <div className="bg-gray-800/50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Raising Seed</h2>
          <p className="text-gray-400 mb-6">
            Currently raising $500K Seed on a $3M cap to hire our first engineers and designers.
          </p>
          <Link
            href="mailto:akshay@rakshex.in"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Contact for Investor Deck →
          </Link>
        </div>
      </div>
    </div>
  );
}
