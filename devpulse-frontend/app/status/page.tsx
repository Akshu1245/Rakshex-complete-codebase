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

        {/* Static Incident logs */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-white mb-6">Recent System Logs (Last 30 Days)</h3>
          <div className="space-y-4">
            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-200">
                  Intermittent latency on scanning engine
                </h4>
                <span className="text-xs text-slate-500">May 15, 2026</span>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Elevated response times during bulk collection uploads. Resolved automatically after
                container scaling.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-400 font-semibold">Resolved</span>
                <span className="text-slate-500">Duration: 12 minutes</span>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-200">OAuth Provider Redirect Outage</h4>
                <span className="text-xs text-slate-500">May 2, 2026</span>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Google OAuth redirect configuration had a mismatch due to an upstream configuration
                roll. Mappings updated.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-400 font-semibold">Resolved</span>
                <span className="text-slate-500">Duration: 4 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
