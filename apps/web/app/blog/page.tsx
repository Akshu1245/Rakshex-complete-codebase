import Link from "next/link";

export const metadata = {
  title: "RaksHex Research Notes",
  description:
    "Evidence-first notes about AI action governance, runtime authorization, credentials, budgets, and agent security.",
  alternates: {
    canonical: "https://rakshex.in/blog",
  },
};

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-transparent text-white pt-28 pb-16 px-6 xl:px-8">
      <div className="max-w-4xl mx-auto">
        <p className="text-[#14B8A6] text-sm font-medium mb-3">RaksHex Research Notes</p>
        <h1 className="text-4xl font-bold mb-4 text-white">Evidence before marketing claims.</h1>
        <p className="text-[#9CA3AF] text-lg leading-relaxed mb-8">
          We are refreshing older articles so every public statement matches what the current private
          beta can prove. Historical comparison posts, benchmark-style savings claims, and broad
          security-detection claims are temporarily unpublished rather than presented as shipped
          product guarantees.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="bg-black/40 rounded-xl p-6 border border-[#1A1F2E]">
            <h2 className="text-lg font-semibold text-white mb-2">What we publish</h2>
            <p className="text-[#9CA3AF] text-sm leading-relaxed">
              Architecture notes, threat-model reasoning, deployment evidence, and clearly scoped
              descriptions of controlled RaksHex paths.
            </p>
          </div>
          <div className="bg-black/40 rounded-xl p-6 border border-[#1A1F2E]">
            <h2 className="text-lg font-semibold text-white mb-2">What we avoid</h2>
            <p className="text-[#9CA3AF] text-sm leading-relaxed">
              Unverified customer claims, universal provider coverage, guaranteed savings,
              certification language, or claims that imply zero vulnerabilities.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/security"
            className="px-5 py-3 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white font-semibold transition-colors"
          >
            Review security architecture
          </Link>
          <Link
            href="/trust"
            className="px-5 py-3 rounded-lg border border-[#1A1F2E] hover:border-[#14B8A6]/50 text-white transition-colors"
          >
            Open Trust Center
          </Link>
          <Link
            href="/docs"
            className="px-5 py-3 rounded-lg border border-[#1A1F2E] hover:border-[#14B8A6]/50 text-white transition-colors"
          >
            Read current docs
          </Link>
        </div>
      </div>
    </div>
  );
}
