"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function ApiKeysPage() {
  const workspaces = trpc.workspaces.listMine.useQuery();
  const workspaceId = workspaces.data?.[0]?.id ?? 0;
  const list = trpc.apiKeys.list.useQuery({ workspaceId }, { enabled: workspaceId > 0 });
  const [name, setName] = useState("CI key");
  const [rawOnce, setRawOnce] = useState<string | null>(null);

  const create = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setRawOnce(data.apiKey);
      list.refetch();
    },
  });
  const revoke = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => list.refetch(),
  });
  const rotate = trpc.apiKeys.rotate.useMutation({
    onSuccess: (data) => {
      setRawOnce(data.apiKey);
      list.refetch();
    },
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">API keys</h1>
          <p className="text-neutral-500 text-sm">
            Keys are hashed at rest. The raw secret is shown only once at creation or rotation.
          </p>
        </div>
        <Link href="/workspace" className="text-sm text-teal-400">
          Workspace
        </Link>
      </div>

      {rawOnce && (
        <div className="mb-6 p-4 bg-amber-900/20 border border-amber-600/40 rounded-lg">
          <p className="text-sm text-amber-200 mb-2 font-medium">
            Copy this key now — it will not be shown again.
          </p>
          <code className="block text-xs break-all bg-black/40 p-3 rounded">{rawOnce}</code>
          <button
            type="button"
            className="mt-2 text-xs text-neutral-400 underline"
            onClick={() => setRawOnce(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!workspaceId) return;
          create.mutate({
            workspaceId,
            name,
            scopes: ["*"],
            environment: "live",
          });
        }}
        className="flex gap-2 mb-8"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm"
          required
        />
        <button
          type="submit"
          disabled={!workspaceId || create.isPending}
          className="px-4 py-2 bg-teal-600 rounded-md text-sm"
        >
          Create key
        </button>
      </form>
      {create.error && <p className="text-red-400 text-sm mb-4">{create.error.message}</p>}

      <div className="space-y-3">
        {(list.data?.keys ?? []).map(
          (k: {
            id: string;
            name: string;
            keyPreview: string;
            revokedAt: string | null;
            scopes: string[];
            lastUsedAt: string | null;
          }) => (
            <div
              key={k.id}
              className="border border-neutral-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-medium text-sm">{k.name}</div>
                <div className="text-xs text-neutral-500 font-mono">{k.keyPreview}</div>
                <div className="text-xs text-neutral-600 mt-1">
                  scopes: {k.scopes.join(", ")}
                  {k.revokedAt ? " · REVOKED" : ""}
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                </div>
              </div>
              {!k.revokedAt && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5 border border-neutral-700 rounded"
                    onClick={() => rotate.mutate({ workspaceId, keyId: k.id })}
                  >
                    Rotate
                  </button>
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5 border border-red-800 text-red-300 rounded"
                    onClick={() => revoke.mutate({ workspaceId, keyId: k.id })}
                  >
                    Revoke
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
