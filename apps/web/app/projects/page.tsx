"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, useApiMutation } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { NotConnectedState } from "@/components/NotConnected";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
}

interface EnvRow {
  id: string;
  name: string;
  kind: string;
  slug: string;
}

export default function ProjectsPage() {
  // Projects have no /v1 equivalent on the Workers deployment —
  // /api/projects answers 501 not_connected. Mutations surface an honest
  // error instead of pretending to create projects.
  const {
    workspaceId,
    isLoading: workspaceLoading,
    notConnected: workspaceNotConnected,
  } = useWorkspace();
  const projects = useApi<ProjectRow[]>(
    workspaceId > 0 ? `/api/projects?workspaceId=${workspaceId}` : null,
  );
  const envs = useApi<EnvRow[]>(
    workspaceId > 0 ? `/api/projects?workspaceId=${workspaceId}&kind=environments` : null,
  );
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const create = useApiMutation<{ workspaceId: number; name: string }, unknown>(
    "/api/projects",
    "POST",
  );

  const notConnected = workspaceNotConnected || projects.notConnected;

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

      {!workspaceId && !workspaceLoading && !notConnected && (
        <p className="text-neutral-400">
          Create a{" "}
          <Link href="/workspace" className="text-teal-400">
            workspace
          </Link>{" "}
          first.
        </p>
      )}

      {notConnected && (
        <NotConnectedState
          resource="Projects"
          detail="Listing projects and environments needs the projects backend, which isn't connected on this deployment yet. Nothing is created or listed here."
        />
      )}

      {createError && (
        <p className="text-red-400 text-sm mb-4" role="alert">
          {createError}
        </p>
      )}

      {!notConnected && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!workspaceId) return;
              setCreateError(null);
              create.mutate(
                { workspaceId, name },
                {
                  onSuccess: () => {
                    setName("");
                    projects.refetch();
                    envs.refetch();
                  },
                  onError: (err) => setCreateError(err.message),
                },
              );
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
            {(projects.data ?? []).map((p) => (
              <div key={p.id} className="border border-neutral-800 rounded-lg p-4">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-neutral-500">{p.slug}</div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-medium mt-10 mb-3">Environments</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {(envs.data ?? []).map((e) => (
              <div key={e.id} className="border border-neutral-800 rounded-lg p-3 text-sm">
                <div className="font-medium">{e.name}</div>
                <div className="text-neutral-500 text-xs">{e.kind}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
