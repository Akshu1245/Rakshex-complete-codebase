"use client";

import { useState } from "react";

interface AgentRow {
  agentId: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
}

interface AgentLeaderboardProps {
  data: AgentRow[];
}

type SortKey = keyof AgentRow;

export default function AgentLeaderboard({ data }: AgentLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("totalCost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    return sortDir === "desc" ? (vb as number) - (va as number) : (va as number) - (vb as number);
  });

  const columns: Array<{ key: SortKey; label: string; fmt?: (v: number) => string }> = [
    { key: "agentId", label: "Agent" },
    { key: "requests", label: "Requests" },
    { key: "totalCost", label: "Cost", fmt: (v) => `$${v.toFixed(2)}` },
    { key: "avgLatency", label: "Avg Latency", fmt: (v) => `${v}ms` },
    { key: "errorRate", label: "Error Rate", fmt: (v) => `${v}%` },
  ];

  return (
    <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Agent Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left py-2 px-3 text-gray-400 font-medium cursor-pointer hover:text-gray-200 select-none"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.agentId} className="border-b border-gray-700/50 hover:bg-gray-750">
                {columns.map((col) => {
                  const val = row[col.key];
                  const display = col.fmt && typeof val === "number" ? col.fmt(val) : String(val);
                  return (
                    <td key={col.key} className="py-2 px-3 text-gray-300">
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-gray-500">
                  No agent data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
