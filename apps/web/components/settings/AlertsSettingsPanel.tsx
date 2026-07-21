"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";

const inputClass =
  "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

type Metric =
  | "cost_usd"
  | "blocked_requests"
  | "redteam_score"
  | "error_rate"
  | "anomaly_score"
  | "latency_p95_ms";

export function AlertsSettingsPanel() {
  const { addToast } = useToast();
  const utils = trpc.useUtils();
  const rulesQuery = trpc.alerts.listRules.useQuery({ limit: 50 });
  const eventsQuery = trpc.alerts.listEvents.useQuery({ limit: 20 });

  const [name, setName] = useState("");
  const [metric, setMetric] = useState<Metric>("cost_usd");
  const [threshold, setThreshold] = useState(100);
  const [discordUrl, setDiscordUrl] = useState("");
  const [window, setWindow] = useState<"1h" | "24h" | "7d">("24h");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");

  const createRule = trpc.alerts.createRule.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
      setName("");
      addToast("success", "Alert rule created");
    },
    onError: (err) => addToast("error", err.message),
  });

  const setEnabled = trpc.alerts.setEnabled.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
      addToast("success", "Alert rule updated");
    },
    onError: (err) => addToast("error", err.message),
  });

  const deleteRule = trpc.alerts.deleteRule.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
      addToast("success", "Alert rule deleted");
    },
    onError: (err) => addToast("error", err.message),
  });

  const testDelivery = trpc.alerts.testDelivery.useMutation({
    onSuccess: (data) => {
      if (data.ok) addToast("success", "Test alert dispatched");
      else addToast("error", data.reason ?? "Test did not fire");
      utils.alerts.listEvents.invalidate();
    },
    onError: (err) => addToast("error", err.message),
  });

  const rules = rulesQuery.data?.items ?? [];
  const events = eventsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">Alert rules</h3>
        <p className="text-sm text-gray-400 mt-1">
          Threshold rules that fan out to Discord, PagerDuty, or registered webhook endpoints.
        </p>
      </div>

      <form
        className="space-y-4 p-4 border border-gray-600 rounded-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (!discordUrl.trim()) {
            addToast("error", "Discord webhook URL is required (or register a webhook first)");
            return;
          }
          createRule.mutate({
            name,
            enabled: true,
            conditions: [{ metric, operator: "gte", threshold }],
            window,
            cooldownMinutes: 60,
            severity,
            channels: { discordWebhookUrl: discordUrl.trim() },
          });
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Rule name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={192}
              placeholder="Daily cost over $100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Metric</label>
            <select
              className={inputClass}
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
            >
              <option value="cost_usd">Cost (USD)</option>
              <option value="blocked_requests">Blocked requests</option>
              <option value="redteam_score">Red-team score</option>
              <option value="error_rate">Error rate</option>
              <option value="anomaly_score">Anomaly score</option>
              <option value="latency_p95_ms">Latency p95 (ms)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Threshold (≥)</label>
            <input
              className={inputClass}
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Window</label>
            <select
              className={inputClass}
              value={window}
              onChange={(e) => setWindow(e.target.value as typeof window)}
            >
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Severity</label>
            <select
              className={inputClass}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Discord webhook URL
            </label>
            <input
              className={inputClass}
              type="url"
              required
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={createRule.isPending}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {createRule.isPending ? "Creating…" : "Create rule"}
        </button>
      </form>

      {rulesQuery.isLoading ? (
        <p className="text-sm text-gray-400">Loading rules…</p>
      ) : rules.length === 0 ? (
        <EmptyState
          compact
          title="No alert rules"
          description="Create a threshold rule to get notified when cost or security metrics breach a limit."
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-700/50 rounded-md border border-gray-600"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium">{rule.name}</span>
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                    {rule.severity}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      rule.enabled
                        ? "bg-green-900/40 text-green-400"
                        : "bg-yellow-900/40 text-yellow-400"
                    }`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {rule.conditions
                    .map((c) => `${c.metric} ${c.operator} ${c.threshold}`)
                    .join("; ")}{" "}
                  · window {rule.window}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={testDelivery.isPending}
                  onClick={() => testDelivery.mutate({ id: rule.id })}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-500 text-gray-200 hover:bg-gray-600"
                >
                  Test
                </button>
                <button
                  type="button"
                  disabled={setEnabled.isPending}
                  onClick={() => setEnabled.mutate({ id: rule.id, enabled: !rule.enabled })}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-500 text-gray-200 hover:bg-gray-600"
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  disabled={deleteRule.isPending}
                  onClick={() => {
                    if (confirm(`Delete rule "${rule.name}"?`)) {
                      deleteRule.mutate({ id: rule.id });
                    }
                  }}
                  className="text-sm px-3 py-1.5 rounded-md text-red-400 hover:bg-red-900/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-white mb-2">Recent alert events</h4>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No alert dispatches yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 10).map((ev) => (
              <li
                key={ev.id}
                className="text-xs text-gray-400 flex justify-between gap-2 p-2 rounded border border-gray-700"
              >
                <span className="truncate">
                  <span className="text-gray-300">{ev.summary}</span>
                  {" · "}
                  {ev.channel}
                  {ev.delivered ? " · delivered" : " · failed"}
                </span>
                <span className="shrink-0">{new Date(ev.firedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
