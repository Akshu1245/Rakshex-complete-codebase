"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function WorkspacePage() {
  const list = trpc.workspaces.listMine.useQuery();
  const [name, setName] = useState("");
  const create = trpc.workspaces.create.useMutation({
    onSuccess: () => {
      setName("");
      list.refetch();
    },
  });

  const workspace = list.data?.[0];
  const workspaceId = workspace?.id ?? 0;
  const members = trpc.workspaces.listMembers.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const perms = trpc.workspaces.myPermissions.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
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

      {list.isLoading && <p className="text-neutral-500">Loading…</p>}

      {workspace && (
        <div className="space-y-6">
          <section className="border border-neutral-800 rounded-lg p-6">
            <h2 className="font-medium mb-2">{workspace.name}</h2>
            <p className="text-sm text-neutral-500">
              slug: {workspace.slug} · your role: {perms.data?.role ?? "…"}
            </p>
          </section>

          <section className="border border-neutral-800 rounded-lg p-6">
            <h2 className="font-medium mb-4">Members</h2>
            <ul className="space-y-2">
              {(members.data ?? []).map((m: { userId: number; role: string; email?: string }) => (
                <li
                  key={m.userId}
                  className="flex justify-between text-sm border-b border-neutral-900 py-2"
                >
                  <span>User #{m.userId}</span>
                  <span className="text-neutral-400">{m.role}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section className="border border-neutral-800 rounded-lg p-6 mt-6">
        <h2 className="font-medium mb-4">Create workspace</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ name });
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
    </div>
  );
}
