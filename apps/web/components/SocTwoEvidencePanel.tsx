"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

export function SocTwoEvidencePanel({ compact = false }: { compact?: boolean }) {
  const [windowDays, setWindowDays] = useState(90);
  const controlsQuery = trpc.socTwo.controls.useQuery();

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const packQuery = trpc.socTwo.evidencePack.useQuery({
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });
  const auditQuery = trpc.socTwo.auditLogExport.useQuery({
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    limit: 500,
  });

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    const rows = auditQuery.data?.rows ?? [];
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = (r as Record<string, unknown>)[h];
            const s = v == null ? "" : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshex-soc2-audit-${windowDays}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const controls = controlsQuery.data?.controls ?? [];
  const pack = packQuery.data;
  const verdicts = (
    pack as {
      controls?: Array<{ controlId: string; title: string; verdict: string; rationale: string }>;
    }
  )?.controls;

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3
            className="text-on-surface font-semibold"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: compact ? "18px" : "22px",
            }}
          >
            SOC 2 Evidence Pack
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Structured control evidence for auditors — not a SOC 2 certification or Vanta/Drata
            connector.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-surface-variant">Window</label>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="px-3 py-2 bg-surface-container-highest/50 border border-outline-variant/30 text-on-surface text-sm"
          >
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!pack || packQuery.isLoading}
          onClick={() => pack && downloadJson(`rakshex-soc2-evidence-${windowDays}d.json`, pack)}
          className="px-4 py-2 bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
          style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}
        >
          {packQuery.isLoading ? "BUILDING…" : "DOWNLOAD EVIDENCE JSON"}
        </button>
        <button
          type="button"
          disabled={!auditQuery.data?.rows?.length || auditQuery.isLoading}
          onClick={downloadCsv}
          className="px-4 py-2 border border-outline-variant/40 text-on-surface text-xs font-bold disabled:opacity-50"
          style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}
        >
          EXPORT AUDIT CSV
        </button>
      </div>

      {controlsQuery.isLoading ? (
        <p className="text-sm text-on-surface-variant">Loading controls…</p>
      ) : controls.length === 0 ? (
        <EmptyState
          compact
          title="No SOC 2 controls catalogued"
          description="The evidence service did not return a control catalogue."
        />
      ) : (
        <div className="overflow-x-auto border border-outline-variant/20 rounded-lg">
          <table
            className="w-full text-left text-sm"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <thead>
              <tr className="text-on-surface-variant border-b border-outline-variant/10 text-xs tracking-wider">
                <th className="px-4 py-3">CONTROL</th>
                <th className="px-4 py-3">TITLE</th>
                <th className="px-4 py-3">VERDICT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {(verdicts ?? controls.map((c) => ({ ...c, verdict: "—", rationale: "" }))).map(
                (c) => (
                  <tr key={c.controlId} className="hover:bg-surface-variant/10">
                    <td className="px-4 py-3 text-primary">{c.controlId}</td>
                    <td className="px-4 py-3 text-on-surface">
                      <div>{c.title}</div>
                      {"rationale" in c && c.rationale ? (
                        <div className="text-xs text-on-surface-variant mt-1 max-w-xl">
                          {c.rationale}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold uppercase ${
                          c.verdict === "pass"
                            ? "text-primary"
                            : c.verdict === "fail"
                              ? "text-error"
                              : "text-on-surface-variant"
                        }`}
                      >
                        {c.verdict}
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {auditQuery.data && (
        <p className="text-xs text-on-surface-variant">
          Audit export window: {auditQuery.data.count} rows between{" "}
          {new Date(auditQuery.data.windowStart).toLocaleDateString()} –{" "}
          {new Date(auditQuery.data.windowEnd).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
