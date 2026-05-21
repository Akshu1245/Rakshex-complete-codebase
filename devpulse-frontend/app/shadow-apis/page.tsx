"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

export default function ShadowAPIsPage() {
  const utils = trpc.useUtils();
  const [selectedCollection, setSelectedCollection] = useState("");
  const [error, setError] = useState<string | null>(null);

  const collectionsQuery = trpc.collections.list.useQuery();
  const collections = collectionsQuery.data?.collections ?? [];

  const shadowQuery = trpc.shadowAPI.listShadowAPIs.useQuery(
    { collectionId: selectedCollection },
    { enabled: !!selectedCollection },
  );
  const shadowAPIs = shadowQuery.data?.shadowAPIs ?? [];

  const scanMutation = trpc.shadowAPI.scanShadowAPIs.useMutation({
    onSuccess: () => {
      if (selectedCollection) {
        utils.shadowAPI.listShadowAPIs.invalidate({
          collectionId: selectedCollection,
        });
      }
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const markMutation = trpc.shadowAPI.markAsDocumented.useMutation({
    onSuccess: () => {
      if (selectedCollection) {
        utils.shadowAPI.listShadowAPIs.invalidate({
          collectionId: selectedCollection,
        });
      }
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCollection(e.target.value);
    setError(null);
  };

  const handleScan = () => {
    if (!selectedCollection) return;
    setError(null);
    scanMutation.mutate({ collectionId: selectedCollection });
  };

  const markAsDocumented = (apiId: string) => {
    setError(null);
    markMutation.mutate({ shadowApiId: apiId });
  };

  const loading = !!selectedCollection && shadowQuery.isLoading;

  const criticalCount = shadowAPIs.filter((a) => a.riskLevel === "HIGH" && !a.isDocumented).length;

  return (
    <div className="p-8 min-h-screen bg-background text-on-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <span
              className="text-primary"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              SHADOW API DISCOVERY
            </span>
            <h2
              className="text-on-surface mt-1"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Shadow API Detection
            </h2>
          </div>
          <button
            onClick={handleScan}
            disabled={!selectedCollection || scanMutation.isPending}
            className="px-6 py-2 bg-primary text-on-primary font-bold hover:shadow-[0_0_15px_rgba(207,188,255,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              radar
            </span>
            {scanMutation.isPending ? "SCANNING…" : "SCAN NOW"}
          </button>
        </div>

        {/* Critical Alert */}
        {criticalCount > 0 && (
          <div className="mb-6 p-4 bg-error/10 border-l-4 border-error glass-card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-error pulse-active"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  warning
                </span>
              </div>
              <div>
                <h4
                  className="text-error font-bold"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                  }}
                >
                  CRITICAL ALERT: {criticalCount} HIGH-RISK SHADOW ENDPOINT
                  {criticalCount > 1 ? "S" : ""} DETECTED
                </h4>
                <p
                  className="text-on-error-container"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
                >
                  Undocumented endpoints may be transmitting sensitive data. Review below.
                </p>
              </div>
            </div>
            <button
              className="px-6 py-2 bg-error text-on-error font-bold uppercase"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.1em",
              }}
            >
              SECURE ENDPOINTS
            </button>
          </div>
        )}

        {error && (
          <div
            className="mb-6 p-4 border-l-4 border-error bg-error/10 text-error"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
          >
            {error}
          </div>
        )}

        {/* Collection selector */}
        <div className="mb-8 glass-card p-6 rounded-xl">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label
                className="text-on-surface-variant block mb-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                }}
              >
                SELECT COLLECTION
              </label>
              <select
                value={selectedCollection}
                onChange={handleCollectionChange}
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
            {selectedCollection && (
              <div className="flex gap-3 text-center">
                <div className="px-4 py-2 bg-surface-container rounded border border-outline-variant/20">
                  <p
                    className="text-on-surface-variant"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                    }}
                  >
                    TOTAL
                  </p>
                  <p className="text-on-surface font-bold" style={{ fontSize: "20px" }}>
                    {shadowAPIs.length}
                  </p>
                </div>
                <div className="px-4 py-2 bg-error/10 rounded border border-error/20">
                  <p
                    className="text-error"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                    }}
                  >
                    CRITICAL
                  </p>
                  <p className="text-error font-bold" style={{ fontSize: "20px" }}>
                    {criticalCount}
                  </p>
                </div>
                <div className="px-4 py-2 bg-primary/10 rounded border border-primary/20">
                  <p
                    className="text-primary"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                    }}
                  >
                    DOCUMENTED
                  </p>
                  <p className="text-primary font-bold" style={{ fontSize: "20px" }}>
                    {shadowAPIs.filter((a) => a.isDocumented).length}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="glass-card rounded-xl overflow-hidden mb-20">
          <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-low/50">
            <h3
              className="text-on-surface flex items-center gap-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: "16px" }}>
                hub
              </span>
              DETECTED API ENDPOINTS
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary pulse-active"></span>
              <span
                className="text-primary"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}
              >
                LIVE NODE SCAN
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
          ) : !selectedCollection ? (
            <div className="p-12 text-center">
              <span
                className="material-symbols-outlined text-on-surface-variant/30"
                style={{ fontSize: "56px" }}
              >
                visibility_off
              </span>
              <p
                className="text-on-surface-variant mt-4"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
              >
                Select a collection to begin shadow API detection
              </p>
            </div>
          ) : shadowAPIs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={
                  <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>
                    visibility
                  </span>
                }
                title="No shadow APIs detected"
                description="Shadow APIs appear when undocumented endpoints are discovered during scanning. Run a scan to start."
                actions={[{ label: "Run Scan", href: "/collections" }]}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-left border-collapse"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <thead>
                  <tr
                    className="bg-surface-container/50 border-b border-outline-variant/10"
                    style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                  >
                    <th className="px-6 py-4 text-on-surface-variant font-bold">ENDPOINT PATH</th>
                    <th className="px-6 py-4 text-on-surface-variant font-bold">METHOD</th>
                    <th className="px-6 py-4 text-on-surface-variant font-bold">RISK LEVEL</th>
                    <th className="px-6 py-4 text-on-surface-variant font-bold">REASON</th>
                    <th className="px-6 py-4 text-on-surface-variant font-bold">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {shadowAPIs.map((api) => (
                    <tr key={api.id} className="hover:bg-surface-variant/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="material-symbols-outlined text-on-surface-variant/50"
                            style={{ fontSize: "16px" }}
                          >
                            api
                          </span>
                          <code className="text-primary" style={{ fontSize: "13px" }}>
                            {api.endpoint}
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{api.method || "—"}</td>
                      <td className="px-6 py-4">
                        {api.isDocumented ? (
                          <span
                            className="px-2 py-0.5 border-l-2 border-primary bg-primary/10 text-primary font-bold"
                            style={{ fontSize: "10px" }}
                          >
                            DOCUMENTED
                          </span>
                        ) : api.riskLevel === "HIGH" ? (
                          <span
                            className="px-2 py-0.5 border-l-2 border-error bg-error/10 text-error font-bold"
                            style={{ fontSize: "10px" }}
                          >
                            CRITICAL
                          </span>
                        ) : (
                          <span
                            className="px-2 py-0.5 border-l-2 border-tertiary bg-tertiary/10 text-tertiary font-bold"
                            style={{ fontSize: "10px" }}
                          >
                            ELEVATED
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4 text-on-surface-variant"
                        style={{ fontSize: "12px" }}
                      >
                        {api.reason || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {!api.isDocumented ? (
                          <button
                            onClick={() => markAsDocumented(api.id)}
                            disabled={markMutation.isPending}
                            className="px-3 py-1.5 bg-primary-container/20 text-primary border border-primary/30 hover:bg-primary-container/40 transition-colors disabled:opacity-50 font-bold"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: "10px",
                              letterSpacing: "0.05em",
                            }}
                          >
                            MARK DOCUMENTED
                          </button>
                        ) : (
                          <span className="text-on-surface-variant" style={{ fontSize: "11px" }}>
                            ✓ Documented
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-surface-container-lowest/50 flex justify-between items-center px-6">
                <span
                  className="text-on-surface-variant"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "0.05em",
                  }}
                >
                  Displaying {shadowAPIs.length} detected endpoint
                  {shadowAPIs.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
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
                SHADOW API SCANNER: OPERATIONAL
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
            DEVPULSE AI — SYSTEM ALPHA-9
          </span>
        </div>
      </div>
    </div>
  );
}
