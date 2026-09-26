"use client";

import Link from "next/link";
import { ArrowUpRight, KeyRound, ShieldAlert, UsersRound, Waypoints } from "lucide-react";
import { useApi } from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";

function formatCost(costUsd: number | undefined) {
  return `$${(costUsd ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A signed-in landing view of the workspace-scoped AI inventory. Detailed
 * credentials, subscriptions, and per-member records stay in Control Plane.
 *
 * Control-plane metrics are not connected on this deployment — the section
 * says so instead of fabricating counts.
 */
interface UsageMember {
  userId: number | string;
  name?: string;
  email?: string;
  costUsd?: number;
}

interface ControlPlaneSummary {
  providers?: number;
  credentials?: number;
  subscriptions?: number;
  openFindings?: number;
}

interface UsageSummary {
  totalRequests?: number;
  totalTokens?: number;
  totalCostUsd?: number;
  byUser?: UsageMember[];
}

export default function AiGovernanceSummary() {
  const { workspaceId, workspace, isLoading: workspaceLoading } = useWorkspace();
  const enabled = Boolean(workspace?.id && workspaceId > 0);
  const summaryQuery = useApi<ControlPlaneSummary>(
    enabled ? `/api/control-plane?kind=summary&workspaceId=${workspaceId}` : null,
  );
  const usageQuery = useApi<UsageSummary>(
    enabled ? `/api/control-plane?kind=usage&workspaceId=${workspaceId}` : null,
  );

  const notConnected = summaryQuery.notConnected || usageQuery.notConnected;
  const loading = workspaceLoading || summaryQuery.isLoading || usageQuery.isLoading;
  const summary = summaryQuery.data;
  const usage = usageQuery.data;
  const topMember = usage?.byUser?.[0];
  const hasInventory = Boolean(
    summary &&
    (summary.providers || summary.credentials || summary.subscriptions || summary.openFindings),
  );

  return (
    <section
      className="border border-glass bg-surface-container-low/70 p-5 md:p-6"
      aria-labelledby="ai-governance-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Waypoints className="h-4 w-4" aria-hidden="true" />
            <p className="font-label-mono text-[11px] uppercase tracking-widest">AI governance</p>
          </div>
          <h2 id="ai-governance-heading" className="mt-2 text-xl font-bold text-white">
            {workspace?.name ?? "Your workspace"} at a glance
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Provider accounts, team subscriptions, governed usage, and discovery findings. Prompts
            and plaintext keys are not shown here.
          </p>
        </div>
        <Link
          href="/control-plane"
          className="inline-flex shrink-0 items-center justify-center gap-2 border border-primary/50 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Open control plane <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-5 grid gap-px border border-glass bg-glass sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Provider accounts"
          value={summary?.providers}
          loading={loading}
          connected={!notConnected}
          icon={Waypoints}
        />
        <Metric
          label="Protected credentials"
          value={summary?.credentials}
          loading={loading}
          connected={!notConnected}
          icon={KeyRound}
        />
        <Metric
          label="Team subscriptions"
          value={summary?.subscriptions}
          loading={loading}
          connected={!notConnected}
          icon={UsersRound}
        />
        <Metric
          label="Open findings"
          value={summary?.openFindings}
          loading={loading}
          connected={!notConnected}
          icon={ShieldAlert}
          alert={(summary?.openFindings ?? 0) > 0}
        />
      </div>

      <div className="mt-5 grid gap-4 border-t border-glass pt-5 lg:grid-cols-[1fr_auto] lg:items-center">
        {notConnected ? (
          <p className="text-sm text-on-surface-variant">
            Control-plane metrics aren&apos;t connected on this deployment yet — nothing here is
            live data. Open the control plane once the backend is connected.
          </p>
        ) : hasInventory ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Readout
              label="Governed requests"
              value={(usage?.totalRequests ?? 0).toLocaleString()}
            />
            <Readout label="Tracked tokens" value={(usage?.totalTokens ?? 0).toLocaleString()} />
            <Readout label="Attributed spend" value={formatCost(usage?.totalCostUsd)} />
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Connect a provider account or import a team subscription to begin your workspace
            inventory. Usage appears after gateway or telemetry ingestion.
          </p>
        )}
        {topMember && (
          <p className="text-sm text-on-surface-variant lg:text-right">
            Highest tracked usage: {topMember.name || topMember.email || `User ${topMember.userId}`}{" "}
            ({formatCost(topMember.costUsd)})
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  loading,
  connected,
  icon: Icon,
  alert = false,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  connected: boolean;
  icon: typeof Waypoints;
  alert?: boolean;
}) {
  return (
    <div className="min-w-0 bg-surface-base/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
        <Icon
          className={`h-4 w-4 ${alert ? "text-status-warning" : "text-primary"}`}
          aria-hidden="true"
        />
      </div>
      <p className={`mt-3 text-2xl font-bold ${alert ? "text-status-warning" : "text-white"}`}>
        {loading || !connected ? "–" : (value ?? 0).toLocaleString()}
      </p>
      {!connected && <p className="mt-1 text-[11px] text-on-surface-variant">Not connected yet</p>}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-label-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
