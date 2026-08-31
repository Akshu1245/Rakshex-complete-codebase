"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-orange-400",
  Medium: "text-yellow-400",
  Low: "text-blue-400",
};

export default function FindingsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const [severity, setSeverity] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [exportFmt, setExportFmt] = useState<"json" | "csv" | "sarif">("json");

  const list = trpc.findings.list.useQuery({
    status: status as any,
    severity: severity as any,
    limit: 100,
  });
  const detail = trpc.findings.get.useQuery({ id: selected! }, { enabled: Boolean(selected) });
  const updateStatus = trpc.findings.updateStatus.useMutation({
    onSuccess: () => {
      list.refetch();
      detail.refetch();
    },
  });
  const bulk = trpc.findings.bulkUpdate.useMutation({ onSuccess: () => list.refetch() });
  const exportQ = trpc.findings.export.useQuery({ format: exportFmt }, { enabled: false });

  const findings = list.data?.findings ?? [];
  const groups = list.data?.groups ?? [];

  const downloadExport = async () => {
    const res = await exportQ.refetch();
    const body = res.data?.body ?? "";
    const blob = new Blob([body], {
      type: exportFmt === "csv" ? "text/csv" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings.${exportFmt === "sarif" ? "sarif.json" : exportFmt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const checked = useMemo(() => new Set<string>(), []);
  void checked;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Findings</h1>
          <p className="text-neutral-500 text-sm break-words">
            Severity, confidence, suppression, accepted risk, and export
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/collections" className="inline-flex min-h-11 items-center text-teal-400">
            Collections
          </Link>
          <Link href="/scanning" className="inline-flex min-h-11 items-center text-teal-400">
            Scans
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <select
          className="w-full lg:w-auto bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          {["open", "in-progress", "resolved", "suppressed", "false_positive", "accepted_risk", "reopened"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="w-full lg:w-auto bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={severity ?? ""}
          onChange={(e) => setSeverity(e.target.value || undefined)}
        >
          <option value="">All severities</option>
          {["Critical", "High", "Medium", "Low"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="w-full lg:w-auto bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={exportFmt}
          onChange={(e) => setExportFmt(e.target.value as any)}
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="sarif">SARIF</option>
        </select>
        <button
          type="button"
          onClick={downloadExport}
          className="w-full lg:w-auto px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm"
        >
          Export
        </button>
        <button
          type="button"
          className="w-full sm:col-span-2 lg:w-auto lg:col-auto px-3 py-2 border border-red-900 text-red-300 rounded text-sm"
          onClick={() => {
            const ids = findings.slice(0, 10).map((f: { id: string }) => f.id);
            if (ids.length) bulk.mutate({ ids, status: "resolved", reason: "bulk resolve" });
          }}
        >
          Bulk resolve (page)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <div className="space-y-2 min-w-0">
          <p className="text-xs text-neutral-500 mb-2 break-words">
            {findings.length} findings · {groups.length} fingerprint groups
          </p>
          {list.isLoading && <p className="text-neutral-500">Loading…</p>}
          {findings.map(
            (f: {
              id: string;
              title: string;
              severity: string;
              status: string;
              confidence?: string;
              fingerprint?: string;
              endpoint?: string;
            }) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelected(f.id)}
                className={`w-full text-left border rounded-lg p-3 text-sm transition-colors min-w-0 ${
                  selected === f.id
                    ? "border-teal-600 bg-teal-950/30"
                    : "border-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2">
                  <span className="font-medium min-w-0 break-words">{f.title}</span>
                  <span className={`${SEVERITY_STYLE[f.severity] ?? ""} shrink-0`}>{f.severity}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-1 break-words">
                  {f.status}
                  {f.confidence ? ` · ${f.confidence}` : ""}
                  {f.endpoint ? ` · ${f.endpoint}` : ""}
                </div>
              </button>
            ),
          )}
        </div>

        <div className="border border-neutral-800 rounded-lg p-4 min-h-[260px] sm:min-h-[320px] min-w-0 overflow-hidden">
          {!selected && <p className="text-neutral-500 text-sm">Select a finding for detail and actions.</p>}
          {detail.data?.finding && (
            <div className="space-y-3 text-sm min-w-0">
              <h2 className="text-lg font-semibold break-words">{detail.data.finding.title}</h2>
              <p className="text-neutral-400 break-words">{detail.data.finding.description}</p>
              <p className="text-xs text-neutral-500 break-all">
                rule: {(detail.data.finding as any).ruleId ?? "—"} · fp: {(detail.data.finding as any).fingerprint ?? "—"}
              </p>
              <p className="text-neutral-300 whitespace-pre-wrap break-words">{detail.data.finding.remediation}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:flex-wrap">
                {(
                  [
                    ["suppress", "suppressed"],
                    ["false positive", "false_positive"],
                    ["accept risk", "accepted_risk"],
                    ["reopen", "reopened"],
                    ["resolve", "resolved"],
                  ] as const
                ).map(([label, st]) => (
                  <button
                    key={st}
                    type="button"
                    className="w-full sm:w-auto px-2 py-1 border border-neutral-700 rounded text-xs hover:bg-neutral-900"
                    onClick={() =>
                      updateStatus.mutate({
                        id: selected!,
                        status: st,
                        reason: `Marked ${label} from UI`,
                        expiresAt:
                          st === "suppressed"
                            ? new Date(Date.now() + 30 * 864e5).toISOString()
                            : undefined,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}