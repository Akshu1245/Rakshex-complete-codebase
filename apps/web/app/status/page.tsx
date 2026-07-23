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

        {/* Live health probes against /api/health (and related checks). */}
        <StatusClient />

        <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-xl font-bold text-white mb-2">Incident history</h3>
          <p className="text-slate-400 text-sm">
            No public incidents are recorded for this deployment yet. When an incident is declared,
            it will appear here with start time, impact, and resolution notes.
          </p>
        </div>
      </div>
    </div>
  );
}
