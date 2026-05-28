"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ResearchPage() {
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const scansQuery = trpc.research.listMemory.useQuery({ limit: 20 });

  interface ResearchMemoryItem {
    id: string;
    topic: string;
    createdAt: string;
    status: string;
  }
  const scans: any[] = (scansQuery.data as any) ?? [];
  const loading = scansQuery.isLoading;

  const runResearchMutation = trpc.research.runResearch.useMutation();

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      await runResearchMutation.mutateAsync({
        topic: topic.trim(),
        searchQueries: [topic.trim()],
        depth: "standard",
        async: true,
      });
      setTopic("");
      scansQuery.refetch();
    } catch (e) {
      console.error("Research failed", e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">AI Security Research</h1>
        <p className="text-gray-400 mb-8">
          Competitive intelligence, market analysis, and threat research for AI runtime governance.
        </p>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-lg font-bold mb-3">Generate Research Report</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Prompt injection trends Q2 2026"
              className="flex-1 bg-gray-700 rounded-lg px-4 py-3 text-white border border-gray-600 focus:border-blue-500 outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="bg-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : scans.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
            <p className="text-gray-400 text-lg mb-2">No competitive scans yet</p>
            <p className="text-gray-500 text-sm">
              Generate a research report above to start tracking competitors.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.slice(0, 10).map((scan: any, i: number) => (
              <div
                key={i}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold">{scan.competitor || scan.name || "Unknown"}</h3>
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full">
                    {scan.source || "web"}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  {scan.summary || scan.description || "No summary available"}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  {scan.scannedAt ? new Date(scan.scannedAt).toLocaleDateString("en-IN") : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
