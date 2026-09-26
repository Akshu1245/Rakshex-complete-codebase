"use client";

import { useState } from "react";
import { useApi, useApiMutation } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";
import { NotConnectedState } from "@/components/NotConnected";
import { useWorkspace } from "@/hooks/useWorkspace";

const inputClass =
  "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm";

interface WebhookEndpoint {
  id: string;
  url: string;
  secretMasked?: string;
  isActive: boolean;
  lastStatus?: string | null;
  events?: string[];
}

interface WebhookEventInfo {
  name: string;
  description?: string;
}

type WebhookEventName =
  | "scan.complete"
  | "scan.started"
  | "finding.discovered"
  | "quota.warning"
  | "kill_switch.triggered"
  | "subscription.updated";

export function WebhooksSettingsPanel() {
  const { addToast } = useToast();
  // Webhooks have no /v1 equivalent on the Workers deployment —
  // /api/settings answers 501 not_connected. Mutations surface an honest
  // error instead of pretending to register webhooks.
  const { workspaceId, workspaces } = useWorkspace();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number>(0);
  const effectiveWorkspaceId = selectedWorkspaceId || workspaceId;
  const listQuery = useApi<WebhookEndpoint[]>(
    effectiveWorkspaceId > 0
      ? `/api/settings?kind=webhooks&workspaceId=${effectiveWorkspaceId}`
      : null,
  );
  const eventsQuery = useApi<{ events: WebhookEventInfo[] }>("/api/settings?kind=webhook-events");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["scan.complete"]);
  const [lastSecret, setLastSecret] = useState<string | null>(null);

  const register = useApiMutation<
    { workspaceId: number; url: string; events: WebhookEventName[] },
    { secret: string }
  >("/api/settings", "POST");
  const setActive = useApiMutation<{ workspaceId: number; id: string; isActive: boolean }, unknown>(
    "/api/settings",
    "PATCH",
  );
  const test = useApiMutation<{ workspaceId: number; id: string }, { delivered: number }>(
    "/api/settings",
    "POST",
  );
  const remove = useApiMutation<{ workspaceId: number; id: string }, unknown>(
    "/api/settings",
    "DELETE",
  );

  const refresh = () => listQuery.refetch();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEvents.length === 0) {
      addToast("error", "Select at least one event");
      return;
    }
    register.mutate(
      {
        workspaceId: effectiveWorkspaceId,
        url,
        events: selectedEvents as WebhookEventName[],
      },
      {
        onSuccess: (data) => {
          refresh();
          setUrl("");
          setLastSecret(data.secret);
          addToast("success", "Webhook registered — copy the secret now");
        },
        onError: (err) => addToast("error", err.message),
      },
    );
  };

  const events = eventsQuery.data?.events ?? [];
  const endpoints = listQuery.data ?? [];

  const toggleEvent = (name: string) => {
    setSelectedEvents((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">Webhooks</h3>
        <p className="text-sm text-gray-400 mt-1">
          Receive HMAC-signed HTTP callbacks for scan, finding, and budget lifecycle events.
        </p>
      </div>

      {lastSecret && (
        <div className="p-4 rounded-md bg-yellow-900/30 border border-yellow-600/40 text-yellow-200 text-sm">
          <p className="font-medium mb-1">Signing secret (shown once)</p>
          <code className="break-all text-xs">{lastSecret}</code>
          <button
            type="button"
            className="block mt-2 text-yellow-300 underline text-xs"
            onClick={() => setLastSecret(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <form className="space-y-4 p-4 border border-gray-600 rounded-md" onSubmit={handleRegister}>
        {workspaces.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Workspace</label>
            <select
              className={inputClass}
              value={effectiveWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(Number(event.target.value))}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Endpoint URL</label>
          <input
            className={inputClass}
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/hooks/rakshex"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Events</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {events.map((ev) => (
              <label
                key={ev.name}
                className="flex items-start gap-2 text-sm text-gray-300 p-2 rounded border border-gray-700"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedEvents.includes(ev.name)}
                  onChange={() => toggleEvent(ev.name)}
                />
                <span>
                  <span className="font-mono text-xs text-blue-300">{ev.name}</span>
                  <span className="block text-xs text-gray-500">{ev.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={register.isPending || !effectiveWorkspaceId}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {register.isPending ? "Registering…" : "Register webhook"}
        </button>
      </form>

      {listQuery.isLoading ? (
        <p className="text-sm text-gray-400">Loading webhooks…</p>
      ) : listQuery.notConnected ? (
        <NotConnectedState
          resource="Webhooks"
          detail="Registering webhooks needs the account backend, which isn't connected on this deployment yet. No callbacks are registered here."
        />
      ) : endpoints.length === 0 ? (
        <EmptyState
          compact
          title="No webhooks yet"
          description="Register an HTTPS endpoint to receive lifecycle events."
        />
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              className="p-4 bg-gray-700/50 rounded-md border border-gray-600 space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-mono truncate">{ep.url}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Secret: {ep.secretMasked} ·{" "}
                    {ep.isActive ? (
                      <span className="text-green-400">Active</span>
                    ) : (
                      <span className="text-yellow-400">Paused</span>
                    )}
                    {ep.lastStatus ? ` · Last: ${ep.lastStatus}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(Array.isArray(ep.events) ? ep.events : []).join(", ") || "No events"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-sm px-3 py-1.5 rounded-md border border-gray-500 text-gray-200 hover:bg-gray-600"
                    disabled={test.isPending}
                    onClick={() =>
                      test.mutate(
                        { workspaceId: effectiveWorkspaceId, id: ep.id },
                        {
                          onSuccess: (data) =>
                            addToast(
                              "success",
                              `Test sent (${data.delivered} delivery attempt${data.delivered === 1 ? "" : "s"})`,
                            ),
                          onError: (err) => addToast("error", err.message),
                        },
                      )
                    }
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    className="text-sm px-3 py-1.5 rounded-md border border-gray-500 text-gray-200 hover:bg-gray-600"
                    disabled={setActive.isPending}
                    onClick={() =>
                      setActive.mutate(
                        { workspaceId: effectiveWorkspaceId, id: ep.id, isActive: !ep.isActive },
                        {
                          onSuccess: () => {
                            refresh();
                            addToast("success", "Webhook updated");
                          },
                          onError: (err) => addToast("error", err.message),
                        },
                      )
                    }
                  >
                    {ep.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    className="text-sm px-3 py-1.5 rounded-md text-red-400 hover:bg-red-900/30"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm("Delete this webhook?")) {
                        remove.mutate(
                          { workspaceId: effectiveWorkspaceId, id: ep.id },
                          {
                            onSuccess: () => {
                              refresh();
                              addToast("success", "Webhook deleted");
                            },
                            onError: (err) => addToast("error", err.message),
                          },
                        );
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
