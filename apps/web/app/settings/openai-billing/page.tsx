"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { trpc } from "@/lib/trpc";

export default function OpenAiBillingSettingsPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const accounts = trpc.controlPlane.providers.accounts.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const openAiAccount = useMemo(
    () => accounts.data?.find((account) => account.provider === "openai") ?? null,
    [accounts.data],
  );

  const status = trpc.providerBilling.connectionStatus.useQuery(
    { workspaceId, providerAccountId: openAiAccount?.id ?? 0 },
    { enabled: workspaceId > 0 && Boolean(openAiAccount?.id) },
  );

  const connect = trpc.providerBilling.connectOpenAiKey.useMutation({
    onSuccess: async () => {
      setSecret("");
      setMessage("OpenAI invoice checksum connected.");
      if (openAiAccount) {
        await utils.providerBilling.connectionStatus.invalidate({
          workspaceId,
          providerAccountId: openAiAccount.id,
        });
      }
    },
    onError: (error) => setMessage(error.message),
  });

  const revoke = trpc.providerBilling.revokeOpenAiKey.useMutation({
    onSuccess: async () => {
      setMessage("OpenAI invoice checksum disconnected. Live gateway tracking is unchanged.");
      if (openAiAccount) {
        await utils.providerBilling.connectionStatus.invalidate({
          workspaceId,
          providerAccountId: openAiAccount.id,
        });
      }
    },
    onError: (error) => setMessage(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!openAiAccount || !secret.trim()) return;
    setMessage(null);
    connect.mutate({
      workspaceId,
      providerAccountId: openAiAccount.id,
      secret: secret.trim(),
    });
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">OpenAI billing checksum</h1>
        <p className="mt-2 text-sm text-gray-400">
          Optional. The Rakshex gateway is the live tracking and control plane: it reserves before
          send, settles from response usage, and applies kill switches before OpenAI is called.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Live tracking works without this key. Add a read-only OpenAI admin key only to match
          gateway-attributed spend to OpenAI Costs and Usage for your organization. Rakshex never
          uses this key to send prompts.
        </p>

        {!openAiAccount ? (
          <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-200">
            Connect an OpenAI provider account first. Gateway tracking itself does not require this
            billing checksum.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label htmlFor="openai-billing-key" className="block text-sm font-medium text-gray-200">
              Read-only OpenAI admin/billing key <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="openai-billing-key"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="sk-admin-…"
              className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-teal-500"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!secret.trim() || connect.isPending}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium hover:bg-teal-500 disabled:opacity-50"
              >
                {connect.isPending ? "Verifying…" : status.data?.connected ? "Replace key" : "Connect"}
              </button>
              {status.data?.connected && (
                <button
                  type="button"
                  onClick={() =>
                    revoke.mutate({ workspaceId, providerAccountId: openAiAccount.id })
                  }
                  disabled={revoke.isPending}
                  className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                >
                  {revoke.isPending ? "Revoking…" : "Revoke"}
                </button>
              )}
            </div>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
      </div>
    </div>
  );
}
