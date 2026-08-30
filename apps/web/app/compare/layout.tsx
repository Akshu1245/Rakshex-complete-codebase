import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function CompareArchiveLayout({ children: _children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent text-white pt-28 pb-16 px-6 xl:px-8">
      <div className="max-w-4xl mx-auto">
        <p className="text-[#14B8A6] text-sm font-medium mb-3">RaksHex Comparison Archive</p>
        <h1 className="text-4xl font-bold mb-4">Comparison pages are being revalidated.</h1>
        <p className="text-[#9CA3AF] text-lg leading-relaxed mb-8">
          Older competitor pages are temporarily unpublished while we re-check every feature,
          pricing, benchmark, and capability statement against current public evidence. We prefer an
          incomplete comparison to an inaccurate one.
        </p>

        <div className="bg-black/40 rounded-xl p-6 border border-[#1A1F2E] mb-8">
          <h2 className="text-lg font-semibold mb-3">Current positioning</h2>
          <p className="text-[#9CA3AF] leading-relaxed">
            RaksHex is a private-beta AI Action Control Plane focused on pre-execution authorization,
            delegated authority, credential mediation, budgets, scoped kill switches, and an Action
            Ledger on controlled paths. It does not claim universal enforcement for traffic that
            bypasses RaksHex, and it does not claim security certifications that have not been
            independently completed.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/security"
            className="px-5 py-3 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white font-semibold transition-colors"
          >
            Security architecture
          </Link>
          <Link
            href="/trust"
            className="px-5 py-3 rounded-lg border border-[#1A1F2E] hover:border-[#14B8A6]/50 text-white transition-colors"
          >
            Trust Center
          </Link>
          <Link
            href="/"
            className="px-5 py-3 rounded-lg border border-[#1A1F2E] hover:border-[#14B8A6]/50 text-white transition-colors"
          >
            Back to RaksHex
          </Link>
        </div>
      </div>
    </div>
  );
}
