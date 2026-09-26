"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, useApiMutation } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { NotConnectedState } from "@/components/NotConnected";
import { WorkspaceSubscriptionCard } from "@/components/workspace/WorkspaceSubscriptionCard";

interface MemberRow {
  userId: number;
  role: string;
  name?: string | null;
  email?: string;
}

interface PermissionsShape {
  role?: string;
  permissions: {
    billing: { read: boolean };
  };
}

export default function WorkspacePage() {
  // Workspaces/team have no /v1 equivalent on the Workers deployment —
  // /api/workspaces and /api/team answer 501 not_connected. Mutations
  // surface an honest error instead of pretending to create workspaces.
  const { workspace, workspaceId, workspaces, switchWorkspace, isLoading, notConnected, refetch } =
    useWorkspace();
  const [name, setName] = useState("");
  const create = useApiMutation<{ name: string }, unknown>("/api/workspaces", "POST");

  const members = useApi<MemberRow[]>(
    workspaceId > 0 ? `/api/team?workspaceId=${workspaceId}&kind=members` : null,
  );
  const perms = useApi<PermissionsShape>(
    workspaceId > 0 ? `/api/team?workspaceId=${workspaceId}&kind=permissions` : null,
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Workspace</h1>
          <p className="text-neutral-500 text-sm">Settings, members, and permissions</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/team" className="text-teal-400 hover:underline">
            Team
          </Link>
          <Link href="/projects" className="text-teal-400 hover:underline">
            Projects
          </Link>
          <Link href="/api-keys" className="text-teal-400 hover:underline">
            API keys
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}

      {notConnected && (
        <NotConnectedState
          resource="Workspaces"
          detail="Listing workspaces, members and permissions needs the workspaces backend, which isn't connected on this deployment yet. Nothing is created or listed here."
        />
      )}

      {!notConnected && workspace && (
        <div className="space-y-6">
          <section className="border border-neutral-800 rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">{workspace.name}</h2>
              {workspaces.length > 1 && (
                <select
                  value={workspace.id}
                  onChange={(event) => switchWorkspace(Number(event.target.value))}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                  aria-label="Active workspace"
                >
                  {workspaces.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-sm text-neutral-500">
              slug: {workspace.slug} · your role: {perms.data?.role ?? "…"}
            </p>
          </section>

          <section className="border border-neutral-800 rounded-lg p-6">
            <h2 className="font-medium mb-4">Members</h2>
            <ul className="space-y-2">
              {(members.data ?? []).map((m) => (
                <li
                  key={m.userId}
                  className="flex justify-between text-sm border-b border-neutral-900 py-2"
                >
                  <span>{m.name || m.email || `User #${m.userId}`}</span>
                  <span className="text-neutral-400">{m.role}</span>
                </li>
              ))}
            </ul>
          </section>

          {perms.data?.permissions.billing.read && (
            <section className="border border-neutral-800 rounded-lg p-6">
              <WorkspaceSubscriptionCard workspaceId={workspaceId} />
            </section>
          )}
        </div>
      )}

      {!notConnected && (
        <section className="border border-neutral-800 rounded-lg p-6 mt-6">
          <h2 className="font-medium mb-4">Create workspace</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(
                { name },
                {
                  onSuccess: () => {
                    setName("");
                    refetch();
                  },
                },
              );
            }}
            className="flex gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm"
              required
            />
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 bg-teal-600 rounded-md text-sm"
            >
              Create
            </button>
          </form>
          {create.error && <p className="text-red-400 text-sm mt-2">{create.error.message}</p>}
        </section>
      )}
    </div>
  );
}
