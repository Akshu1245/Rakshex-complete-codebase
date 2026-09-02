"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminWaitlistPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const waitlist = trpc.admin.listAllWaitlist.useQuery();
  const entries = waitlist.data?.entries ?? [];

  const stats = useMemo(() => ({
    total: entries.length,
    verified: entries.filter((e) => e.verified).length,
    production: entries.filter((e) => e.agentStage === "production").length,
    pilot: entries.filter((e) => e.pilotInterest === "yes").length,
    design: entries.filter((e) => e.designPartner).length,
    highIntent: entries.filter((e) => e.qualificationScore >= 65 && !e.flagged).length,
  }), [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "verified" && !e.verified) return false;
      if (filter === "production" && e.agentStage !== "production") return false;
      if (filter === "pilot" && e.pilotInterest !== "yes") return false;
      if (filter === "design" && !e.designPartner) return false;
      if (filter === "flagged" && !e.flagged) return false;
      if (!q) return true;
      return [e.email, e.company, e.role, e.source, e.utmSource, e.utmCampaign, e.pain]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    });
  }, [entries, filter, query]);

  const exportCsv = () => {
    const headers = ["Email","Verified","Role","Company","Agent stage","Providers","Frameworks","Spend","Pain","Pilot","Design partner","Qualification","Fraud","Referrals","Source","UTM source","UTM campaign","Created"];
    const rows = entries.map((e) => [e.email,e.verified,e.role ?? "",e.company ?? "",e.agentStage ?? "",e.providers.join(" | "),e.frameworks.join(" | "),e.monthlySpend ?? "",e.pain ?? "",e.pilotInterest ?? "",e.designPartner,e.qualificationScore,e.fraudScore,e.referralCount,e.source,e.utmSource ?? "",e.utmCampaign ?? "",new Date(e.createdAt).toISOString()]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `rakshex-traction-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><Link href="/admin" className="text-sm text-[#14B8A6]">← Admin</Link><h1 className="mt-2 text-3xl font-bold">Waitlist traction</h1><p className="mt-1 text-sm text-slate-400">Verified demand, ICP quality, pilot intent and acquisition attribution.</p></div>
          <div className="flex gap-2"><button onClick={() => waitlist.refetch()} className="rounded-md border border-slate-700 px-3 py-2 text-sm">Refresh</button><button onClick={exportCsv} className="rounded-md bg-[#14B8A6] px-3 py-2 text-sm font-semibold">Export CSV</button></div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[["Total",stats.total],["Verified",stats.verified],["Production",stats.production],["Pilot yes",stats.pilot],["Design partners",stats.design],["High intent",stats.highIntent]].map(([label,value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, company, role, source, campaign, pain…" className="min-h-11 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-11 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm"><option value="all">All</option><option value="verified">Verified</option><option value="production">Production agents</option><option value="pilot">Pilot yes</option><option value="design">Design partners</option><option value="flagged">Flagged</option></select>
        </div>

        {waitlist.isError && <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{waitlist.error.message}</div>}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Lead</th><th className="p-3">Fit</th><th className="p-3">Stack / pain</th><th className="p-3">Intent</th><th className="p-3">Acquisition</th><th className="p-3">Quality</th></tr></thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {waitlist.isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No matching entries.</td></tr> : filtered.map((e) => (
                <tr key={e.id} className="align-top hover:bg-slate-900/30">
                  <td className="p-3"><div className="font-semibold">{e.email}</div><div className="mt-1 text-xs text-slate-500">{e.company || "No company"} · {e.role || "No role"}</div><div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] ${e.verified ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>{e.verified ? "verified" : "pending"}</div></td>
                  <td className="p-3"><div>{e.agentStage || "—"}</div><div className="mt-1 text-xs text-slate-500">Spend: {e.monthlySpend || "—"}</div></td>
                  <td className="max-w-xs p-3"><div className="text-xs text-slate-300">{[...e.providers, ...e.frameworks].join(", ") || "—"}</div><div className="mt-2 text-xs text-[#8FE3D8]">{e.pain || "—"}</div></td>
                  <td className="p-3"><div>Pilot: <strong>{e.pilotInterest || "—"}</strong></div><div className="mt-1 text-xs text-slate-500">Design partner: {e.designPartner ? "yes" : "no"}</div><div className="mt-1 text-xs text-slate-500">Verified referrals: {e.referralCount}</div></td>
                  <td className="p-3"><div>{e.utmSource || e.source}</div><div className="mt-1 text-xs text-slate-500">{e.utmCampaign || "—"}</div></td>
                  <td className="p-3"><div className="font-semibold">ICP {e.qualificationScore}/100</div><div className={`mt-1 text-xs ${e.flagged ? "text-red-300" : "text-slate-500"}`}>Fraud {e.fraudScore}/100 {e.flagged ? "· flagged" : ""}</div><div className="mt-2 text-[11px] text-slate-600">{new Date(e.createdAt).toLocaleString()}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
