"use client";

import { trpc } from "@/lib/trpc";

type Confidence = "Exact" | "Observed" | "Estimated" | "N/A";

const CHIP_STYLES: Record<Confidence, string> = {
  Exact: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  Observed: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  Estimated: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "N/A": "bg-neutral-500/15 text-neutral-300 border-neutral-500/40",
};

function ConfidenceChip({ value }: { value: Confidence }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 font-label-mono text-[10px] uppercase tracking-wider ${CHIP_STYLES[value]}`}
      title={
        value === "Exact"
          ? "A number you declared yourself"
          : value === "Observed"
            ? "Metered directly by RaksHex"
            : value === "Estimated"
              ? "Derived from token counts and the price table — not a provider invoice"
              : "No data available; nothing is being invented here"
      }
    >
      {value}
    </span>
  );
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Spend vs ceiling card for the Command Center dashboard.
 * Reads from `spend.summary` (documented contract in apps/api/api/spend.ts).
 * Every figure carries an honesty chip: Exact / Observed / Estimated / N/A.
 * No ceiling set → the card says so instead of guessing one.
 */
export default function SpendVsCeiling() {
  const workspaces = trpc.workspaces.listMine.useQuery();
  const workspaceId = workspaces.data?.[0]?.id ?? 0;
  const summary = trpc.spend.summary.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0, refetchInterval: 60000, retry: 1 },
  );

  const data = summary.data;
  const loading = summary.isLoading;
  const maxSpent = Math.max(1e-9, ...(data?.rows.map((r) => r.spent) ?? [0]));

  return (
    <section
      aria-labelledby="spend-ceiling-heading"
      className="glass-card col-span-12 p-6 md:col-span-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="spend-ceiling-heading"
            className="font-headline-md text-headline-md font-bold text-white"
          >
            Spend vs ceiling
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Last {data?.windowDays ?? 30} days · each figure labeled by how it was measured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">
            payments
          </span>
          <button
            type="button"
            onClick={() => summary.refetch()}
            disabled={summary.isFetching}
            aria-label="Refresh spend figures"
            className="rounded-lg border border-glass px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {summary.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && (
        <p className="py-6 text-center text-sm text-on-surface-variant" role="status">
          Loading spend figures…
        </p>
      )}
      {summary.error && (
        <p className="py-6 text-center text-sm text-status-error" role="alert">
          Could not load spend figures: {summary.error.message}
        </p>
      )}

      {data && !loading && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-glass bg-surface-container-low p-4">
            <div>
              <p className="font-label-mono text-[11px] uppercase tracking-wider text-on-surface-variant">
                Total spend
              </p>
              <p className="text-2xl font-bold text-white">{formatUsd(data.totals.spent)}</p>
            </div>
            <ConfidenceChip value={data.totals.confidence} />
            <div className="ml-auto text-right">
              <p className="font-label-mono text-[11px] uppercase tracking-wider text-on-surface-variant">
                Ceiling
              </p>
              {data.ceiling.amount != null ? (
                <p className="text-2xl font-bold text-white">{formatUsd(data.ceiling.amount)}</p>
              ) : (
                <p className="text-sm text-on-surface-variant">No ceiling set</p>
              )}
            </div>
            <ConfidenceChip value={data.ceiling.confidence} />
          </div>

          {data.rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-on-surface-variant">
              No spend recorded in this window. Figures appear once gateway or telemetry
              ingestion runs.
            </p>
          ) : (
            <ul className="space-y-4">
              {data.rows.slice(0, 8).map((row) => {
                const pct =
                  row.ceiling != null && row.ceiling > 0
                    ? Math.min(100, (row.spent / row.ceiling) * 100)
                    : (row.spent / maxSpent) * 100;
                const barLabel =
                  row.ceiling != null
                    ? `${formatUsd(row.spent)} of ${formatUsd(row.ceiling)} ceiling`
                    : `${formatUsd(row.spent)} — no ceiling set`;
                return (
                  <li key={row.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{row.label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm text-on-surface">
                          {formatUsd(row.spent)}
                        </span>
                        <ConfidenceChip value={row.confidence} />
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={barLabel}
                      aria-valuemin={0}
                      aria-valuemax={row.ceiling ?? maxSpent}
                      aria-valuenow={row.spent}
                      aria-valuetext={barLabel}
                      className="h-2 overflow-hidden rounded-full bg-surface-container"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {row.detail && (
                      <p className="mt-1 text-[11px] text-on-surface-variant">{row.detail}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {data.ledgerStatus === "pending" && (
            <p className="mt-4 border-t border-glass pt-3 text-[11px] text-on-surface-variant">
              Per-agent and per-key breakdown arrives with the spend ledger; model-level figures
              are shown until then.
            </p>
          )}
        </>
      )}
    </section>
  );
}
