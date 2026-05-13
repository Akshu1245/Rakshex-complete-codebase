"use client";
import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";

export default function ShadowAPIsPage() {
  const utils = trpc.useUtils();
  const [selectedCollection, setSelectedCollection] = useState("");
  const [error, setError] = useState<string | null>(null);

  const collectionsQuery = trpc.collections.list.useQuery();
  const collections = collectionsQuery.data?.collections ?? [];

  const shadowQuery = trpc.shadowAPI.listShadowAPIs.useQuery(
    { collectionId: selectedCollection },
    { enabled: !!selectedCollection }
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

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Shadow APIs</h1>
            <p className="text-gray-400 mt-1">
              Detect undocumented endpoints in your collections
            </p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="mb-8 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">
              Select Collection
            </label>
            <select
              value={selectedCollection}
              onChange={handleCollectionChange}
              className="w-full max-w-md px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Select a collection --</option>
              {collections.map(col => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleScan}
            disabled={!selectedCollection || scanMutation.isPending}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
          >
            {scanMutation.isPending ? "Scanning…" : "Scan now"}
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : !selectedCollection ? (
            <EmptyState
              icon={<span>🔎</span>}
              title="Pick a collection"
              description="Shadow-API detection compares your production traffic against the endpoints defined in each collection. Select one above to get started."
              actions={[
                {
                  label: "Import a collection",
                  href: "/collections",
                },
              ]}
            />
          ) : shadowAPIs.length === 0 ? (
            <EmptyState
              icon={<span>✅</span>}
              title="No shadow APIs found"
              description="Every endpoint seen in traffic is documented in this collection. Nice work."
              actions={[
                {
                  label: "Run another scan",
                  href: "/scanning",
                  variant: "secondary",
                },
              ]}
            />
          ) : (
            shadowAPIs.map(api => (
              <div
                key={api.id}
                className={`p-4 rounded-lg border ${
                  api.isDocumented
                    ? "bg-gray-800 border-gray-700"
                    : api.riskLevel === "HIGH"
                      ? "bg-red-900/30 border-red-500"
                      : "bg-yellow-900/30 border-yellow-500"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-sm ${
                          api.riskLevel === "HIGH"
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {api.riskLevel}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {api.method}
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-gray-300">{api.endpoint}</p>
                    {api.reason && (
                      <p className="text-xs text-gray-500 mt-1">
                        {api.reason}
                      </p>
                    )}
                  </div>
                  {!api.isDocumented ? (
                    <button
                      onClick={() => markAsDocumented(api.id)}
                      disabled={markMutation.isPending}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Mark Documented
                    </button>
                  ) : (
                    <span className="px-3 py-1 bg-gray-700 rounded text-sm text-gray-400">
                      Documented
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
