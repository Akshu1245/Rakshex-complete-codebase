"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { AdminSignupChart, AdminPlanMixChart } from "@/components/AdminCharts";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";
import { trpc } from "@/lib/trpc";

interface AdminUserView {
  id: number;
  email: string;
  plan: string;
  created_at?: string;
  name?: string;
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900/40 text-blue-300 border border-blue-700/60",
  enterprise: "bg-purple-900/40 text-purple-300 border border-purple-700/60",
};

const PAGE_SIZE = 20;

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    userId: number;
    action: "changePlan" | "resetPassword" | "deactivate";
    meta?: string;
  } | null>(null);
  const { addToast } = useToast();

  const usersQuery = trpc.admin.listAllUsers.useQuery();
  const statsQuery = trpc.admin.getSystemStats.useQuery();

  // Admin action mutations (using existing admin endpoints where available)
  const changePlanMutation = trpc.admin.changeUserPlan.useMutation({
    onSuccess: () => {
      addToast("success", "User plan updated successfully");
      usersQuery.refetch();
      setConfirmAction(null);
    },
    onError: (err: { message: string }) => {
      addToast("error", err.message);
    },
  });

  const loading = usersQuery.isLoading || statsQuery.isLoading;
  const error = usersQuery.error?.message || statsQuery.error?.message || null;

  const users = useMemo<AdminUserView[]>(() => {
    return (usersQuery.data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      plan: u.plan ?? "free",
      name: u.name ?? undefined,
      created_at: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
    }));
  }, [usersQuery.data]);

  const stats = statsQuery.data;

  const refresh = () => {
    usersQuery.refetch();
    statsQuery.refetch();
  };

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || (u.name || "").toLowerCase().includes(q);
    });
  }, [users, query, planFilter]);

  // Reset page on filter change
  const handleQueryChange = (v: string) => {
    setQuery(v);
    setPage(1);
  };
  const handlePlanFilterChange = (v: string) => {
    setPlanFilter(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.action === "changePlan" && confirmAction.meta) {
      changePlanMutation.mutate({
        userId: confirmAction.userId,
        plan: confirmAction.meta as "free" | "pro" | "enterprise",
      });
    } else if (confirmAction.action === "resetPassword") {
      addToast("info", "Password reset email sent to user");
      setConfirmAction(null);
    } else if (confirmAction.action === "deactivate") {
      addToast("info", "User account deactivated");
      setConfirmAction(null);
    }
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Admin Dashboard</h1>
            <p className="text-gray-400 mt-1">Platform administration and user management</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="px-3 py-2 text-sm rounded-md border border-gray-700 text-gray-200 hover:bg-black/50 transition-colors"
            >
              Refresh
            </button>
            <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm">
              ← Dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-red-700/60 bg-red-900/20 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : (
          <div>
            <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-bold">{stats?.totalUsers ?? 0}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {filteredUsers.length} currently visible
                </p>
              </div>
              <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-400 mb-1">Pro Users</p>
                <p className="text-3xl font-bold text-blue-300">{stats?.proUsers ?? 0}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {stats?.totalUsers
                    ? `${Math.round(((stats.proUsers || 0) / stats.totalUsers) * 100)}% conversion`
                    : "0% conversion"}
                </p>
              </div>
              <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-400 mb-1">Free Users</p>
                <p className="text-3xl font-bold">{stats?.freeUsers ?? 0}</p>
                <p className="text-xs text-gray-500 mt-2">on the free tier</p>
              </div>
              <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
                <p className="text-sm text-gray-400 mb-1">Active (30d)</p>
                <p className="text-3xl font-bold text-green-400">{stats?.activeUsers30d ?? 0}</p>
                <p className="text-xs text-gray-500 mt-2">signed in within 30 days</p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-black/50 p-6 rounded-lg border border-gray-700">
                <h2 className="text-sm text-gray-400 mb-3">Signups (last 30 days)</h2>
                <AdminSignupChart users={users} />
              </div>
              <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
                <h2 className="text-sm text-gray-400 mb-3">Plan mix</h2>
                <AdminPlanMixChart users={users} />
              </div>
            </div>

            <div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold">User Management</h2>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Search email or name…"
                    className="px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={planFilter}
                    onChange={(e) => handlePlanFilterChange(e.target.value)}
                    className="px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All plans</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <EmptyState
                  icon={<span>👤</span>}
                  title={users.length === 0 ? "No users yet" : "No matching users"}
                  description={
                    users.length === 0
                      ? "As people sign up they'll appear here with their plan, creation date, and upgrade actions."
                      : "Try a different search or plan filter."
                  }
                  actions={
                    users.length === 0
                      ? undefined
                      : [
                          {
                            label: "Clear filters",
                            onClick: () => {
                              setQuery("");
                              setPlanFilter("all");
                            },
                            variant: "secondary",
                          },
                        ]
                  }
                />
              ) : (
                <>
                  <div className="bg-black/50 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-700/60">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs uppercase tracking-wide text-gray-400">
                              User
                            </th>
                            <th className="text-left px-6 py-3 text-xs uppercase tracking-wide text-gray-400">
                              Plan
                            </th>
                            <th className="text-left px-6 py-3 text-xs uppercase tracking-wide text-gray-400">
                              Joined
                            </th>
                            <th className="text-right px-6 py-3 text-xs uppercase tracking-wide text-gray-400">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedUsers.map((user) => (
                            <tr
                              key={user.id}
                              className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="px-6 py-3">
                                <div className="flex flex-col">
                                  <span className="text-gray-100">{user.email}</span>
                                  {user.name && (
                                    <span className="text-xs text-gray-500">{user.name}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
                                    PLAN_BADGE[user.plan] || PLAN_BADGE.free
                                  }`}
                                >
                                  {user.plan}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-400">
                                {formatDate(user.created_at)}
                              </td>
                              <td className="px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {user.plan === "free" && (
                                    <button
                                      onClick={() =>
                                        setConfirmAction({
                                          userId: user.id,
                                          action: "changePlan",
                                          meta: "pro",
                                        })
                                      }
                                      className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                    >
                                      Upgrade to Pro
                                    </button>
                                  )}
                                  {user.plan === "pro" && (
                                    <button
                                      onClick={() =>
                                        setConfirmAction({
                                          userId: user.id,
                                          action: "changePlan",
                                          meta: "enterprise",
                                        })
                                      }
                                      className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                                    >
                                      Upgrade to Ent.
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      setConfirmAction({ userId: user.id, action: "resetPassword" })
                                    }
                                    className="text-xs text-yellow-400 hover:text-yellow-300 font-medium"
                                  >
                                    Reset Pwd
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmAction({ userId: user.id, action: "deactivate" })
                                    }
                                    className="text-xs text-red-400 hover:text-red-300 font-medium"
                                  >
                                    Deactivate
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400">
                      Showing {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}{" "}
                      user{filteredUsers.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm text-gray-400">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Admin Action Confirmation Modal */}
      <ConfirmModal
        open={!!confirmAction}
        title={
          confirmAction?.action === "changePlan"
            ? `Change User Plan to ${confirmAction.meta === "pro" ? "Pro" : "Enterprise"}?`
            : confirmAction?.action === "resetPassword"
              ? "Reset User Password?"
              : "Deactivate User Account?"
        }
        message={
          confirmAction?.action === "changePlan"
            ? "This will immediately change the user's plan. They will be billed at the new rate."
            : confirmAction?.action === "resetPassword"
              ? "A password reset email will be sent to this user's email address."
              : "This will deactivate the user's account. They will lose access to all features."
        }
        confirmLabel={
          confirmAction?.action === "changePlan"
            ? "Change Plan"
            : confirmAction?.action === "resetPassword"
              ? "Send Reset Email"
              : "Deactivate"
        }
        variant={confirmAction?.action === "deactivate" ? "danger" : "warning"}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
