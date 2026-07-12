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
  const bulk = trpc.findings.bulkUpdate.useMutation({
    onSuccess: () => list.refetch(),
  });
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Findings</h1>
          <p className="text-neutral-500 text-sm">
            Severity, confidence, suppression, accepted risk, and export
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/collections" className="text-teal-400">
            Collections
          </Link>
          <Link href="/scanning" className="text-teal-400">
            Scans
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          {[
            "open",
            "in-progress",
            "resolved",
            "suppressed",
            "false_positive",
            "accepted_risk",
            "reopened",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={severity ?? ""}
          onChange={(e) => setSeverity(e.target.value || undefined)}
        >
          <option value="">All severities</option>
          {["Critical", "High", "Medium", "Low"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
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
          className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm"
        >
          Export
        </button>
        <button
          type="button"
          className="px-3 py-2 border border-red-900 text-red-300 rounded text-sm"
          onClick={() => {
            const ids = findings.slice(0, 10).map((f: { id: string }) => f.id);
            if (ids.length) bulk.mutate({ ids, status: "resolved", reason: "bulk resolve" });
          }}
        >
          Bulk resolve (page)
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-xs text-neutral-500 mb-2">
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
                className={`w-full text-left border rounded-lg p-3 text-sm transition-colors ${
                  selected === f.id
                    ? "border-teal-600 bg-teal-950/30"
                    : "border-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{f.title}</span>
                  <span className={SEVERITY_STYLE[f.severity] ?? ""}>{f.severity}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {f.status}
                  {f.confidence ? ` · ${f.confidence}` : ""}
                  {f.endpoint ? ` · ${f.endpoint}` : ""}
                </div>
              </button>
            ),
          )}
        </div>

        <div className="border border-neutral-800 rounded-lg p-4 min-h-[320px]">
          {!selected && (
            <p className="text-neutral-500 text-sm">Select a finding for detail and actions.</p>
          )}
          {detail.data?.finding && (
            <div className="space-y-3 text-sm">
              <h2 className="text-lg font-semibold">{detail.data.finding.title}</h2>
              <p className="text-neutral-400">{detail.data.finding.description}</p>
              <p className="text-xs text-neutral-500">
                rule: {(detail.data.finding as any).ruleId ?? "—"} · fp:{" "}
                {(detail.data.finding as any).fingerprint ?? "—"}
              </p>
              <p className="text-neutral-300 whitespace-pre-wrap">
                {detail.data.finding.remediation}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
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
                    className="px-2 py-1 border border-neutral-700 rounded text-xs hover:bg-neutral-900"
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
