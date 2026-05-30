"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { trpc } from "@/lib/trpc";

interface WaitlistEntry {
  id: number;
  email: string;
  plan: string;
  source: string;
  createdAt: string | Date;
}

const PLAN_BADGE: Record<string, string> = {
  Free: "bg-gray-700/60 text-gray-300 border border-gray-600/40",
  Pro: "bg-blue-900/40 text-blue-300 border border-blue-700/60",
  Enterprise: "bg-purple-900/40 text-purple-300 border border-purple-700/60",
};

const PAGE_SIZE = 15;

function formatDate(value?: string | Date): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminWaitlistPage() {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { addToast } = useToast();

  const waitlistQuery = trpc.admin.listAllWaitlist.useQuery();

  const loading = waitlistQuery.isLoading;
  const error = waitlistQuery.error?.message || null;

  const entries = useMemo<WaitlistEntry[]>(() => {
    return (waitlistQuery.data?.entries ?? []).map((e) => ({
      id: e.id,
      email: e.email ?? "",
      plan: e.plan ?? "Free",
      source: e.source ?? "landing_page",
      createdAt: e.createdAt,
    }));
  }, [waitlistQuery.data]);

  const refresh = () => {
    waitlistQuery.refetch();
  };

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (planFilter !== "all" && e.plan.toLowerCase() !== planFilter.toLowerCase()) return false;
      if (!q) return true;
      return e.email.toLowerCase().includes(q) || e.source.toLowerCase().includes(q);
    });
  }, [entries, query, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const pagedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // CSV Export function
  const exportToCSV = () => {
    if (entries.length === 0) {
      addToast("info", "No entries to export");
      return;
    }
    const headers = ["ID", "Email", "Plan Interest", "Signup Date", "Source Page"];
    const rows = entries.map((e) => [
      e.id,
      e.email,
      e.plan,
      new Date(e.createdAt).toISOString(),
      e.source,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RaksHex_waitlist_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("success", "Waitlist export initiated");
  };

  return (
    <div className="text-white p-8 min-h-screen bg-slate-950 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
              <Link href="/admin" className="hover:underline">
                Admin Dashboard
              </Link>
              <span>/</span>
              <span className="text-gray-400">Waitlist Management</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Waitlist Signups
            </h1>
            <p className="text-gray-400 mt-1">Manage early access requests and beta plans</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20"
            >
              Export CSV
            </button>
            <button
              onClick={refresh}
              className="px-3 py-2 text-sm rounded-lg border border-slate-800 bg-slate-900 text-gray-200 hover:bg-slate-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-700/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
            <p className="text-sm font-medium text-gray-400">Total Signups</p>
            <p className="text-3xl font-semibold mt-2 text-blue-400">{entries.length}</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
            <p className="text-sm font-medium text-gray-400">Pro Interest</p>
            <p className="text-3xl font-semibold mt-2 text-indigo-400">
              {entries.filter((e) => e.plan.toLowerCase() === "pro").length}
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
            <p className="text-sm font-medium text-gray-400">Enterprise Interest</p>
            <p className="text-3xl font-semibold mt-2 text-purple-400">
              {entries.filter((e) => e.plan.toLowerCase() === "enterprise").length}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by email or source..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 whitespace-nowrap">Filter by Plan:</span>
              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950/80 border border-slate-800 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-850">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/80">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                  >
                    Email Address
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                  >
                    Interested Plan
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                  >
                    Signup Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                  >
                    Source Page
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></span>
                        Loading waitlist entries...
                      </div>
                    </td>
                  </tr>
                ) : pagedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      No signups match your search/filters
                    </td>
                  </tr>
                ) : (
                  pagedEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-200">
                        {e.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PLAN_BADGE[e.plan] ?? PLAN_BADGE.Free}`}
                        >
                          {e.plan}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                        {formatDate(e.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400">
                        <code className="text-xs text-indigo-400 bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-900/30">
                          {e.source}
                        </code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-3 mt-4">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="relative inline-flex items-center rounded-md border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="relative ml-3 inline-flex items-center rounded-md border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    Showing{" "}
                    <span className="font-medium text-gray-200">{(page - 1) * PAGE_SIZE + 1}</span>{" "}
                    to{" "}
                    <span className="font-medium text-gray-200">
                      {Math.min(filteredEntries.length, page * PAGE_SIZE)}
                    </span>{" "}
                    of <span className="font-medium text-gray-200">{filteredEntries.length}</span>{" "}
                    results
                  </p>
                </div>
                <div>
                  <nav
                    className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                    aria-label="Pagination"
                  >
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(1)}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-slate-850 hover:bg-slate-900 focus:z-20 focus:outline-offset-0 disabled:opacity-30"
                    >
                      «
                    </button>
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-slate-850 hover:bg-slate-900 focus:z-20 focus:outline-offset-0 disabled:opacity-30"
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pNum = idx + 1;
                      const isCurrent = pNum === page;
                      return (
                        <button
                          key={pNum}
                          onClick={() => setPage(pNum)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                            isCurrent
                              ? "z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                              : "text-gray-400 ring-1 ring-inset ring-slate-850 hover:bg-slate-900"
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-slate-850 hover:bg-slate-900 focus:z-20 focus:outline-offset-0 disabled:opacity-30"
                    >
                      ›
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(totalPages)}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-slate-850 hover:bg-slate-900 focus:z-20 focus:outline-offset-0 disabled:opacity-30"
                    >
                      »
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
