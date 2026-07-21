import StatusClient from "./StatusClient";

export const metadata = {
  title: "Status — RaksHex System Status",
  description:
    "Real-time status of RaksHex runtime governance engines, scan services, and system infrastructure.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10 text-center sm:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            System Status
          </h1>
          <p className="text-slate-400 mt-2 text-base">
            Monitor the real-time operational state of RaksHex AI runtime firewalls and scanning
            APIs.
          </p>
        </header>

        {/* Dynamic Client Service health checks */}
        <StatusClient />

        {/* Example incident format — not live history */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-white mb-2">Incident history format</h3>
          <p className="text-sm text-amber-200/80 mb-6 border border-amber-500/30 bg-amber-500/5 rounded-lg px-4 py-3">
            Example only — the entries below are illustrative samples of how incidents would appear.
            They are not live production incidents.
          </p>
          <div className="space-y-4 opacity-80">
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-200">
                  [Example] Intermittent latency on scanning engine
                </h4>
                <span className="text-xs text-slate-500">Sample</span>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Placeholder description for elevated response times during bulk uploads.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400 font-semibold">Example</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
