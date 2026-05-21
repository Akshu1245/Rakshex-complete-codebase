"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Framework = "pci_dss" | "owasp";

export default function CompliancePage() {
  const utils = trpc.useUtils();
  const [selectedFramework, setSelectedFramework] = useState<Framework>("pci_dss");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [error, setError] = useState<string | null>(null);

  const collectionsQuery = trpc.collections.list.useQuery();
  const collections = collectionsQuery.data?.collections ?? [];

  const reportsQuery = trpc.compliance.listReports.useQuery(
    { collectionId: selectedCollection },
    { enabled: !!selectedCollection },
  );
  const reports = reportsQuery.data?.reports ?? [];
  const loading = !!selectedCollection && reportsQuery.isLoading;

  const generate = trpc.compliance.generateReport.useMutation({
    onSuccess: () => {
      if (selectedCollection) {
        utils.compliance.listReports.invalidate({
          collectionId: selectedCollection,
        });
      }
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const generateReport = () => {
    if (!selectedCollection) {
      setError("Pick a collection first.");
      return;
    }
    setError(null);
    generate.mutate({
      collectionId: selectedCollection,
      reportType: selectedFramework,
    });
  };

  /** Export a compliance report as a downloadable JSON file */
  const handleExport = (report: {
    id: string;
    reportType: string;
    complianceScore: number;
    totalRequirements: number;
    metRequirements: number;
    createdAt: string | Date;
    details?: unknown;
  }) => {
    const exportData = {
      reportId: report.id,
      reportType: report.reportType,
      complianceScore: report.complianceScore,
      totalRequirements: report.totalRequirements,
      metRequirements: report.metRequirements,
      generatedAt: report.createdAt,
      details: report.details,
      exportedAt: new Date().toISOString(),
      framework: selectedFramework,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshex-compliance-${report.reportType}-${new Date(report.createdAt).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const score = reports.length > 0 ? Math.round(reports[0].complianceScore) : 0;
  const totalReqs = reports.length > 0 ? reports[0].totalRequirements : 0;
  const metReqs = reports.length > 0 ? reports[0].metRequirements : 0;
  const circumference = 440;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="p-8 min-h-screen bg-background text-on-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <span
              className="font-label-caps text-primary tracking-widest"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
            >
              AUDIT &amp; COMPLIANCE COMMAND
            </span>
            <h2
              className="font-display-lg text-on-surface mt-1"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Compliance Control Panel
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateReport}
              disabled={!selectedCollection || generate.isPending}
              className="px-6 py-2 bg-primary text-on-primary font-bold hover:shadow-[0_0_15px_rgba(207,188,255,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                refresh
              </span>
              {generate.isPending ? "GENERATING…" : "RUN NEW AUDIT"}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-6 p-4 border-l-4 border-error bg-error/10 text-error"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
          >
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label
              className="font-label-caps text-on-surface-variant block mb-2"
              style={{ fontSize: "11px", letterSpacing: "0.1em" }}
            >
              COMPLIANCE FRAMEWORK
            </label>
            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value as Framework)}
              className="w-full px-4 py-2.5 bg-surface-container-highest/50 border border-outline-variant/30 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            >
              <option value="pci_dss">PCI DSS V4.0</option>
              <option value="owasp">OWASP ASVS</option>
            </select>
          </div>
          <div>
            <label
              className="font-label-caps text-on-surface-variant block mb-2"
              style={{ fontSize: "11px", letterSpacing: "0.1em" }}
            >
              COLLECTION
            </label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-container-highest/50 border border-outline-variant/30 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            >
              <option value="">-- SELECT COLLECTION --</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-gutter mb-8">
          {/* Score Ring */}
          <div className="col-span-12 md:col-span-4 glass-panel p-6 relative overflow-hidden">
            <div className="scan-animation"></div>
            <div className="flex items-center justify-between mb-8">
              <span
                className="font-label-caps text-on-surface-variant"
                style={{ fontSize: "10px", letterSpacing: "0.1em" }}
              >
                FRAMEWORK: {selectedFramework === "pci_dss" ? "PCI DSS V4.0" : "OWASP ASVS"}
              </span>
              <span className="flex items-center gap-1.5 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary status-pulse"></span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
                  LIVE SYNC
                </span>
              </span>
            </div>
            <div className="flex items-center justify-center py-4 relative">
              <svg className="w-40 h-40" style={{ transform: "rotate(-90deg)" }}>
                <circle
                  className="text-surface-variant"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="8"
                />
                <circle
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="70"
                  stroke={score < 80 ? "#ffb4ab" : "#cfbcff"}
                  strokeDasharray={circumference}
                  strokeDashoffset={reports.length > 0 ? offset : circumference}
                  strokeLinecap="round"
                  strokeWidth="8"
                  style={{ transition: "stroke-dashoffset 1s ease-out" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "48px",
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: score < 80 ? "#ffb4ab" : "#cfbcff",
                  }}
                >
                  {reports.length > 0 ? `${score}%` : "—"}
                </span>
                <span
                  className="text-on-surface-variant"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                  }}
                >
                  COMPLIANT
                </span>
              </div>
            </div>
            <div className="mt-6 flex justify-between border-t border-outline-variant/10 pt-4">
              <div className="text-center">
                <p
                  className="text-on-surface-variant"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.1em",
                  }}
                >
                  TOTAL CONTROLS
                </p>
                <p
                  className="text-on-surface"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16px" }}
                >
                  {totalReqs || "—"}
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-on-surface-variant"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.1em",
                  }}
                >
                  PASSED
                </p>
                <p
                  className="text-primary"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16px" }}
                >
                  {metReqs || "—"}
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-on-surface-variant"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.1em",
                  }}
                >
                  REMAINING
                </p>
                <p
                  className="text-error"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16px" }}
                >
                  {totalReqs > 0 ? totalReqs - metReqs : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Reports table */}
          <div className="col-span-12 md:col-span-8 glass-panel overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
              <h3
                className="text-on-surface"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                }}
              >
                AUDIT REPORT STREAM
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontSize: "14px" }}
                >
                  circle
                </span>
                <span
                  className="text-primary"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}
                >
                  MONITORING ACTIVE
                </span>
              </div>
            </div>

            {!selectedCollection ? (
              <div className="p-12 text-center">
                <span
                  className="material-symbols-outlined text-on-surface-variant/30"
                  style={{ fontSize: "48px" }}
                >
                  gavel
                </span>
                <p
                  className="text-on-surface-variant mt-4"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
                >
                  Select a collection to view compliance reports
                </p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center">
                <span
                  className="material-symbols-outlined text-on-surface-variant/30"
                  style={{ fontSize: "48px" }}
                >
                  assignment
                </span>
                <p
                  className="text-on-surface-variant mt-4"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
                >
                  No reports yet. Run a new audit above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <thead>
                    <tr
                      className="text-on-surface-variant border-b border-outline-variant/10"
                      style={{ fontSize: "11px", letterSpacing: "0.1em" }}
                    >
                      <th className="px-6 py-4">FRAMEWORK</th>
                      <th className="px-6 py-4">SCORE</th>
                      <th className="px-6 py-4">MET / TOTAL</th>
                      <th className="px-6 py-4">GENERATED</th>
                      <th className="px-6 py-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {reports.map((report) => {
                      const s = Math.round(report.complianceScore);
                      return (
                        <tr
                          key={report.id}
                          className="hover:bg-surface-variant/20 transition-colors"
                        >
                          <td className="px-6 py-4 text-primary">
                            {report.reportType.replace("_", " ").toUpperCase()}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 border-l-2 font-bold text-xs ${s >= 80 ? "border-primary bg-primary/10 text-primary" : "border-error bg-error/10 text-error"}`}
                            >
                              {s}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-on-surface-variant">
                            {report.metRequirements} / {report.totalRequirements}
                          </td>
                          <td className="px-6 py-4 text-on-surface-variant">
                            {new Date(report.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleExport(report as never)}
                              className="px-3 py-1.5 bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-variant transition-colors flex items-center gap-1.5 ml-auto"
                              style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "14px" }}
                              >
                                file_download
                              </span>
                              EXPORT
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="fixed bottom-0 left-0 md:left-64 right-0 h-10 bg-surface-container-lowest/80 backdrop-blur-lg border-t border-outline-variant/10 z-30 px-6 flex items-center justify-between">
          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span
                className="text-on-surface-variant"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                }}
              >
                COMPLIANCE ENGINE: OPERATIONAL
              </span>
            </div>
          </div>
          <span
            className="text-on-surface-variant"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.1em",
            }}
          >
            RAKSHEX AI — SYSTEM ALPHA-9
          </span>
        </div>
      </div>
    </div>
  );
}
