"use client";

interface LedgerRow {
  id: string;
  occurredAt: string;
  semanticAction: string;
  mode: string;
  decision: string;
  resource: string | null;
  outcomeStatus: string;
}

function stripeColor(decision: string): string {
  if (decision === "ALLOW") return "border-l-emerald-400";
  if (decision === "APPROVAL_REQUIRED") return "border-l-amber-300";
  return "border-l-red-400";
}

function decisionBadge(decision: string): string {
  if (decision === "ALLOW") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (decision === "APPROVAL_REQUIRED") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function outcomeTone(outcome: string): string {
  const o = outcome.toLowerCase();
  if (o.includes("fail") || o.includes("error")) return "text-red-300";
  if (o.includes("pending")) return "text-amber-200";
  return "text-gray-400";
}

/**
 * Renders the Action Ledger as a decision timeline — each entry reads as
 * an evaluated action, not a generic table row: what was asked, under
 * what mode, what the decision was, and what happened after. A colored
 * left stripe (the decision) is the thing a reviewer scans for first.
 */
export function LedgerTimeline({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-gray-500">
        No protected actions yet. Complete the three setup steps above.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg border border-white/10 border-l-[3px] ${stripeColor(row.decision)} bg-black/20 px-4 py-3`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-white">{row.semanticAction}</span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${decisionBadge(row.decision)}`}
              >
                {row.decision}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {row.resource || "any resource"} · <span className="capitalize">{row.mode}</span> mode
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs">
            <span className={outcomeTone(row.outcomeStatus)}>{row.outcomeStatus}</span>
            <span className="text-gray-500">{new Date(row.occurredAt).toLocaleString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
