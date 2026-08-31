"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

export default function ReportListPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { addToast } = useToast();
  const [openId, setOpenId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);

  const findingsQuery = trpc.findings.list.useQuery({ limit: 100 });
  const reportsQuery = trpc.reports.listMine.useQuery();
  const createReport = trpc.reports.create.useMutation({
    onSuccess: (data) => {
      void utils.reports.listMine.invalidate();
      addToast("success", "Report generated");
      router.push(`/report/${data.reportId}`);
    },
    onError: (err) => addToast("error", err.message),
  });
  const revokeReport = trpc.reports.revoke.useMutation({
    onSuccess: () => {
      void utils.reports.listMine.invalidate();
      addToast("success", "Report revoked");
    },
    onError: (err) => addToast("error", err.message),
  });

  const findings = findingsQuery.data?.findings ?? [];
  const latestScanId = findings[0]?.scanId;

  const handleGenerate = () => {
    if (!latestScanId) {
      addToast("error", "No findings to include — run a scan first");
      return;
    }
    createReport.mutate({ scanId: latestScanId, expiresInDays });
  };

  return (
    <div className="text-white p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-400">Scan Reports</h1>
          <p className="text-gray-400 mt-1 break-words">
            Generate a shareable report from your current findings, or open an existing report ID.
          </p>
        </div>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center text-blue-400 hover:text-blue-300 text-sm shrink-0">
          ← Dashboard
        </Link>
      </div>

      <div className="bg-black/50 border border-gray-700 rounded-lg p-4 sm:p-6 mb-8 space-y-4 min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Generate from findings</h2>
            <p className="text-sm text-gray-400 mt-1 break-all">
              {findingsQuery.isLoading
                ? "Loading findings…"
                : latestScanId
                  ? `Latest scan ${latestScanId} · server-derived, tamper-resistant snapshot`
                  : "No completed scan findings available"}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center">
            <select
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              className="w-full sm:w-auto px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm"
              aria-label="Report expiry"
            >
              <option value={7}>Expires in 7 days</option>
              <option value={30}>Expires in 30 days</option>
              <option value={90}>Expires in 90 days</option>
            </select>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={createReport.isPending || findingsQuery.isLoading || !latestScanId}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md text-sm font-semibold"
            >
              {createReport.isPending ? "Generating…" : "Generate report"}
            </button>
          </div>
        </div>
        {!latestScanId && !findingsQuery.isLoading && (
          <EmptyState
            compact
            title="No findings to report"
            description="Run a collection scan first, then generate a shareable report."
            actions={[{ label: "Go to scanning", href: "/scanning", variant: "secondary" }]}
          />
        )}
      </div>

      <div className="bg-black/50 border border-gray-700 rounded-lg p-4 sm:p-6 mb-8 min-w-0">
        <h2 className="text-lg font-semibold mb-3">Open by report ID</h2>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const id = openId.trim();
            if (!id) return;
            router.push(`/report/${id}`);
          }}
        >
          <input
            value={openId}
            onChange={(e) => setOpenId(e.target.value)}
            placeholder="Report ID"
            className="min-w-0 flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm"
          />
          <button type="submit" className="w-full sm:w-auto px-4 py-2 border border-gray-500 rounded-md text-sm hover:bg-gray-700">
            Open
          </button>
        </form>
      </div>

      <div className="bg-black/50 border border-gray-700 rounded-lg p-4 sm:p-6 min-w-0">
        <h2 className="text-lg font-semibold mb-3">Your generated reports</h2>
        {reportsQuery.isLoading ? (
          <p className="text-sm text-gray-400">Loading reports…</p>
        ) : !reportsQuery.data?.length ? (
          <EmptyState compact title="No recent reports" description="Authenticated, expiring reports you create will appear here." />
        ) : (
          <ul className="space-y-2">
            {reportsQuery.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-3 rounded-md border border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <Link href={`/report/${r.id}`} className="min-w-0 flex-1 hover:border-blue-500/50">
                  <p className="font-mono text-sm text-blue-300 break-all">{r.id}</p>
                  <p className="text-xs text-gray-500 mt-1 break-words">
                    Score {r.score} · {r.findingCount} findings · {new Date(r.createdAt).toLocaleString()}
                    {r.revokedAt
                      ? " · revoked"
                      : r.expiresAt
                        ? ` · expires ${new Date(r.expiresAt).toLocaleDateString()}`
                        : ""}
                  </p>
                </Link>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:shrink-0">
                  {!r.revokedAt && (
                    <button
                      type="button"
                      className="w-full sm:w-auto text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-300 hover:bg-red-900/20"
                      disabled={revokeReport.isPending}
                      onClick={() => {
                        if (confirm("Revoke this shareable report link?")) revokeReport.mutate({ id: r.id });
                      }}
                    >
                      Revoke
                    </button>
                  )}
                  <Link href={`/report/${r.id}`} className="inline-flex min-h-11 items-center justify-center text-sm text-gray-400">
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}