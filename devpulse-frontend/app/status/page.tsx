export const metadata = {
  title: "Status — Rakshex System Status",
  description: "Real-time status of Rakshex services, APIs, and infrastructure.",
  alternates: { canonical: "/status" },
};

const SERVICES = [
  { name: "API", status: "operational", uptime: "99.98%" },
  { name: "Dashboard", status: "operational", uptime: "99.99%" },
  { name: "Authentication", status: "operational", uptime: "99.97%" },
  { name: "Scanning Engine", status: "operational", uptime: "99.95%" },
  { name: "Cost Monitoring", status: "operational", uptime: "99.99%" },
  { name: "Email Delivery", status: "operational", uptime: "99.92%" },
  { name: "Billing", status: "operational", uptime: "99.99%" },
  { name: "Redis Cache", status: "operational", uptime: "99.99%" },
];

const INCIDENTS = [
  {
    date: "May 15, 2026",
    title: "Intermittent latency on scanning engine",
    status: "resolved",
    duration: "12 minutes",
    desc: "Elevated response times due to a queue backlog. Cleared automatically after scale-out.",
  },
  {
    date: "May 10, 2026",
    title: "Email delivery delay",
    status: "resolved",
    duration: "8 minutes",
    desc: "SendGrid API degradation caused delayed transactional emails. Retried successfully.",
  },
];

export default function StatusPage() {
  const allOperational = SERVICES.every((s) => s.status === "operational");

  return (
    <div className="min-h-screen bg-gray-900 text-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">System Status</h1>
        <p className="text-gray-400 mb-8">Last updated: May 17, 2026 at 11:30 AM IST</p>

        {/* Overall Status */}
        <div
          className={`p-6 rounded-xl border mb-10 flex items-center gap-4 ${
            allOperational
              ? "bg-green-900/20 border-green-500/30"
              : "bg-amber-900/20 border-amber-500/30"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full ${
              allOperational ? "bg-green-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <div>
            <h2 className="text-xl font-bold">
              {allOperational ? "All Systems Operational" : "Partial Service Disruption"}
            </h2>
            <p className="text-gray-400 text-sm">
              {allOperational
                ? "No incidents reported in the last 30 days."
                : "Some services may be experiencing issues. We are investigating."}
            </p>
          </div>
        </div>

        {/* Services */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-10">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 font-semibold">Service</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Uptime (30d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {SERVICES.map((s) => (
                <tr key={s.name}>
                  <td className="p-4 font-medium">{s.name}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-green-400 capitalize">{s.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-right text-gray-400">{s.uptime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Incidents */}
        <h2 className="text-2xl font-bold mb-6">Recent Incidents</h2>
        {INCIDENTS.length === 0 ? (
          <p className="text-gray-400">No incidents in the last 30 days.</p>
        ) : (
          <div className="space-y-4">
            {INCIDENTS.map((inc) => (
              <div key={inc.title} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{inc.title}</h3>
                  <span className="text-xs text-gray-500">{inc.date}</span>
                </div>
                <p className="text-gray-400 text-sm mb-3">{inc.desc}</p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-green-400 font-medium capitalize">{inc.status}</span>
                  <span className="text-gray-500">Duration: {inc.duration}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
