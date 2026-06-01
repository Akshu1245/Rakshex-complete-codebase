"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");

  const auditQuery = trpc.settings.getAuditLog.useQuery({ limit: 100 });

  const filteredLogs = useMemo(() => {
    const all = auditQuery.data?.logs ?? [];
    if (!filter) return all;
    return all.filter((l) => l.action === filter);
  }, [auditQuery.data, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const loading = auditQuery.isLoading;

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const formatDate = (dateStr: string | Date) => {
    return new Date(dateStr).toLocaleString();
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      user_login: "bg-green-900/30 text-green-400",
      user_logout: "bg-gray-700 text-gray-300",
      collection_created: "bg-blue-900/30 text-blue-400",
      collection_deleted: "bg-red-900/30 text-red-400",
      scan_triggered: "bg-purple-900/30 text-purple-400",
      kill_switch_triggered: "bg-red-900/40 text-red-300",
      team_invite_sent: "bg-yellow-900/30 text-yellow-400",
      plan_upgraded: "bg-green-900/40 text-green-300",
    };
    return colors[action] || "bg-gray-700 text-gray-300";
  };

  /** Derive a human-readable resource label from the log entry */
  const getResourceLabel = (log: {
    action: string;
    details?: unknown;
    ipAddress?: string | null;
  }) => {
    if (log.details && typeof log.details === "object") {
      // Try common resource identifier keys
      const d = log.details as Record<string, unknown>;
      if (d.collectionName) return String(d.collectionName);
      if (d.collectionId) return String(d.collectionId);
      if (d.plan) return String(d.plan);
      if (d.email) return String(d.email);
      if (d.target) return String(d.target);
      if (d.resource) return String(d.resource);
    }
    // Fallback: infer from action type
    if (log.action.startsWith("user_")) return "Account";
    if (log.action.startsWith("collection_")) return "Collection";
    if (log.action.startsWith("scan_")) return "Scan";
    if (log.action.startsWith("kill_switch_")) return "Kill Switch";
    if (log.action.startsWith("team_")) return "Team";
    if (log.action.startsWith("plan_")) return "Billing";
    return "—";
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-400 mb-6">Audit Log</h1>

        <div className="mb-4 flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-600 rounded-lg px-3 py-2 bg-black/50 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Actions</option>
            <option value="user_login">User Login</option>
            <option value="collection_created">Collection Created</option>
            <option value="collection_deleted">Collection Deleted</option>
            <option value="scan_triggered">Scan Triggered</option>
            <option value="kill_switch_triggered">Kill Switch</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={
              <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>
                description
              </span>
            }
            title="No audit events yet"
            description="User actions and security events appear here automatically as your team uses RaksHex."
          />
        ) : (
          <>
            <div className="bg-black/50 rounded-lg border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-700/50">
                      <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700 whitespace-nowrap">
                        Time
                      </th>
                      <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700 whitespace-nowrap">
                        Action
                      </th>
                      <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700 whitespace-nowrap">
                        Resource
                      </th>
                      <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700 whitespace-nowrap">
                        Details
                      </th>
                      <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700 whitespace-nowrap">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLogs.map((log) => (
                      <tr
                        key={log.id}
                        data-testid={`audit-entry-${log.action}`}
                        className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="p-3 text-sm text-gray-300 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-sm ${getActionColor(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-300">{getResourceLabel(log)}</td>
                        <td className="p-3 text-sm text-gray-300">
                          {log.details ? (
                            <pre className="text-xs text-gray-400 max-w-xs overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-300 whitespace-nowrap">
                          {log.ipAddress || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-gray-400 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
