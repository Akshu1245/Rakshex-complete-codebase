"use client";
import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";

type Framework = "pci_dss" | "owasp";

export default function CompliancePage() {
  const utils = trpc.useUtils();
  const [selectedFramework, setSelectedFramework] =
    useState<Framework>("pci_dss");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [error, setError] = useState<string | null>(null);

  const collectionsQuery = trpc.collections.list.useQuery();
  const collections = collectionsQuery.data?.collections ?? [];

  const reportsQuery = trpc.compliance.listReports.useQuery(
    { collectionId: selectedCollection },
    { enabled: !!selectedCollection }
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
  const handleExport = (report: { id: string; reportType: string; complianceScore: number; totalRequirements: number; metRequirements: number; createdAt: string | Date; details?: unknown }) => {
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
    a.download = `devpulse-compliance-${report.reportType}-${new Date(report.createdAt).toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">
              Compliance Reports
            </h1>
            <p className="text-gray-400 mt-1">
              PCI DSS and OWASP compliance assessment
            </p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            ← Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Compliance Framework
            </label>
            <select
              value={selectedFramework}
              onChange={e =>
                setSelectedFramework(e.target.value as Framework)
              }
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="pci_dss">PCI DSS</option>
              <option value="owasp">OWASP Top 10</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Collection
            </label>
            <select
              value={selectedCollection}
              onChange={e => setSelectedCollection(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Select a collection --</option>
              {collections.map(col => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={generateReport}
          disabled={!selectedCollection || generate.isPending}
          className="mb-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {generate.isPending ? "Generating…" : "Generate New Report"}
        </button>

        {!selectedCollection ? (
          <EmptyState
            icon={<span>📋</span>}
            title="Pick a collection"
            description="Compliance reports are scoped to a collection. Select one above to view existing reports or generate a new one."
            actions={[
              {
                label: "Import a collection",
                href: "/collections",
                variant: "secondary",
              },
            ]}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<span>📋</span>}
            title="No compliance reports yet"
            description="Generate a PCI DSS or OWASP Top 10 report to see how each framework scores this collection."
            actions={[
              {
                label: "Generate report",
                onClick: generateReport,
              },
            ]}
          />
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <div
                key={report.id}
                className="bg-gray-800 p-6 rounded-lg border border-gray-700"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold uppercase">
                      {report.reportType.replace("_", " ")}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-4xl font-bold">
                        {Math.round(report.complianceScore)}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleExport(report as never)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      title="Export report as JSON"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-400">
                    {report.totalRequirements} requirements ·{" "}
                    {report.metRequirements} met
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
