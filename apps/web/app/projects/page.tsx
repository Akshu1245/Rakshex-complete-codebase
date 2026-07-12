"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function ProjectsPage() {
  const workspaces = trpc.workspaces.listMine.useQuery();
  const workspaceId = workspaces.data?.[0]?.id ?? 0;
  const projects = trpc.projects.list.useQuery({ workspaceId }, { enabled: workspaceId > 0 });
  const envs = trpc.projects.listEnvironments.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const [name, setName] = useState("");
  const create = trpc.projects.create.useMutation({
    onSuccess: () => {
      setName("");
      projects.refetch();
      envs.refetch();
    },
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-neutral-500 text-sm">
            Workspace-scoped projects with Development, Staging, Production environments
          </p>
        </div>
        <Link href="/workspace" className="text-sm text-teal-400">
          Workspace
        </Link>
      </div>

      {!workspaceId && !workspaces.isLoading && (
        <p className="text-neutral-400">
          Create a{" "}
          <Link href="/workspace" className="text-teal-400">
            workspace
          </Link>{" "}
          first.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (workspaceId) create.mutate({ workspaceId, name });
        }}
        className="flex gap-2 mb-8"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm"
          required
        />
        <button
          type="submit"
          className="px-4 py-2 bg-teal-600 rounded-md text-sm"
          disabled={!workspaceId}
        >
          Create
        </button>
      </form>

      <div className="space-y-3">
        {(projects.data ?? []).map((p: { id: string; name: string; slug: string }) => (
          <div key={p.id} className="border border-neutral-800 rounded-lg p-4">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-neutral-500">{p.slug}</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-medium mt-10 mb-3">Environments</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {(envs.data ?? []).map((e: { id: string; name: string; kind: string; slug: string }) => (
          <div key={e.id} className="border border-neutral-800 rounded-lg p-3 text-sm">
            <div className="font-medium">{e.name}</div>
            <div className="text-neutral-500 text-xs">{e.kind}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
