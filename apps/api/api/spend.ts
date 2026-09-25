/**
 * Spend summary — read-only spend-vs-ceiling data for the dashboard widget.
 *
 * ── CONTRACT (stable for the Team B merge — B1's ledger is the source) ──
 *   spend.summary({ workspaceId })
 *     → {
 *         currency: "USD",
 *         windowDays: number,            // trailing window the rows cover
 *         generatedAt: string,           // ISO timestamp
 *         ledgerStatus: "pending" | "live",
 *           // "live" when spend_ledger is readable; "pending" falls back to
 *           // token-usage aggregation (model-level rows only).
 *         ceiling: {
 *           amount: number | null,       // USD; null when no ceiling is set
 *           source: "user-budget" | "none",
 *           confidence: "Exact" | "N/A",
 *         },
 *         rows: Array<{
 *           id: string,                  // "agent:<id>" | "key:<id>" | "model:<name>"
 *           kind: "agent" | "key" | "model",
 *           label: string,
 *           spent: number,               // USD in the window
 *           ceiling: number | null,      // per-row USD ceiling, if any
 *           confidence: "Exact" | "Observed" | "Estimated" | "N/A",
 *           detail?: string,             // human note on how the figure was derived
 *         }>,
 *         totals: { spent: number, confidence: "Exact" | "Observed" | "Estimated" | "N/A" },
 *       }
 *
 * Honesty rules for this surface:
 *   - "Exact"      — a user-declared number (their own budget/ceiling).
 *   - "Observed"   — metered by us (counts we recorded ourselves).
 *   - "Estimated"  — derived (e.g. tokens × price table, not an invoice).
 *   - "N/A"        — no data; the widget must say so instead of inventing.
 * Row confidence uses the weakest signal label in the group, mapped from
 * the ledger's exact|observed|estimated|not_available.
 * Totals sum agent rows only — key rows are a second view of the same spend,
 * not additive.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { spendLedger } from "@rakshex/database";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertWorkspacePermission } from "../services/workspaceContext";

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });

export type SpendConfidence = "Exact" | "Observed" | "Estimated" | "N/A";

export interface SpendRow {
  id: string;
  kind: "agent" | "key" | "model";
  label: string;
  spent: number;
  ceiling: number | null;
  confidence: SpendConfidence;
  detail?: string;
}

export interface SpendSummary {
  currency: "USD";
  windowDays: number;
  generatedAt: string;
  ledgerStatus: "pending" | "live";
  ceiling: { amount: number | null; source: "user-budget" | "none"; confidence: SpendConfidence };
  rows: SpendRow[];
  totals: { spent: number; confidence: SpendConfidence };
}

const WINDOW_DAYS = 30;

/**
 * Weakest-link rank: exact(0) > observed(1) > estimated(2) > not_available(3).
 * A group is only as certain as its least certain entry.
 */
const LABEL_RANK_SQL = sql`MAX(CASE ${spendLedger.signalLabel} WHEN 'exact' THEN 0 WHEN 'observed' THEN 1 WHEN 'estimated' THEN 2 ELSE 3 END)`;

function rankToConfidence(rank: number): SpendConfidence {
  if (rank <= 0) return "Exact";
  if (rank === 1) return "Observed";
  if (rank === 2) return "Estimated";
  return "N/A";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function windowStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - WINDOW_DAYS);
  return d;
}

const NO_CEILING = {
  amount: null,
  source: "none" as const,
  confidence: "N/A" as SpendConfidence,
};

async function summarizeFromLedger(workspaceId: number): Promise<SpendSummary> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const since = windowStart();

  const agentGroups = await database.execute<{
    scope_id: string;
    total: string;
    worst_rank: number;
  }>(sql`
    SELECT agent_id AS scope_id,
           COALESCE(SUM(cost_usd), 0) AS total,
           ${LABEL_RANK_SQL} AS worst_rank
    FROM spend_ledger
    WHERE workspace_id = ${workspaceId} AND occurred_at >= ${since}
    GROUP BY agent_id
    ORDER BY SUM(cost_usd) DESC
  `);

  const keyGroups = await database.execute<{
    scope_id: string;
    total: string;
    worst_rank: number;
  }>(sql`
    SELECT key_id AS scope_id,
           COALESCE(SUM(cost_usd), 0) AS total,
           ${LABEL_RANK_SQL} AS worst_rank
    FROM spend_ledger
    WHERE workspace_id = ${workspaceId} AND occurred_at >= ${since} AND key_id IS NOT NULL
    GROUP BY key_id
    ORDER BY SUM(cost_usd) DESC
  `);

  const rows: SpendRow[] = [];
  for (const g of agentGroups.rows) {
    const spent = round2(Number(g.total));
    rows.push({
      id: `agent:${g.scope_id}`,
      kind: "agent",
      label: g.scope_id,
      spent,
      ceiling: null,
      confidence: rankToConfidence(Number(g.worst_rank)),
      detail: "Settled spend from the append-only spend ledger.",
    });
  }
  for (const g of keyGroups.rows) {
    const spent = round2(Number(g.total));
    rows.push({
      id: `key:${g.scope_id}`,
      kind: "key",
      label: g.scope_id,
      spent,
      ceiling: null,
      confidence: rankToConfidence(Number(g.worst_rank)),
      detail: "Settled spend from the append-only spend ledger.",
    });
  }

  const total = round2(rows.filter((r) => r.kind === "agent").reduce((n, r) => n + r.spent, 0));
  const worstRank = Math.max(-1, ...rows.map((r) => confidenceToRank(r.confidence)));
  return {
    currency: "USD",
    windowDays: WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    ledgerStatus: "live",
    ceiling: NO_CEILING,
    rows,
    totals: {
      spent: total,
      confidence: worstRank < 0 ? "N/A" : rankToConfidence(worstRank),
    },
  };
}

function confidenceToRank(c: SpendConfidence): number {
  return c === "Exact" ? 0 : c === "Observed" ? 1 : c === "Estimated" ? 2 : 3;
}

/** Fallback while spend_ledger is not yet migrated/readable: model-level token usage. */
async function summarizeFromTokenUsage(userId: number): Promise<SpendSummary> {
  const usage = await db.getTokenUsageByUserId(userId, WINDOW_DAYS);
  const byModel = new Map<string, number>();
  for (const u of usage) {
    const model = (u.model as string | null) ?? "unknown";
    byModel.set(model, (byModel.get(model) ?? 0) + Number(u.costUSD ?? 0));
  }
  const rows: SpendRow[] = Array.from(byModel.entries())
    .map(([model, spent]) => ({
      id: `model:${model}`,
      kind: "model" as const,
      label: model,
      spent: round2(spent),
      ceiling: null,
      confidence: "Estimated" as SpendConfidence,
      detail: "Derived from recorded token counts × price table — not a provider invoice.",
    }))
    .sort((a, b) => b.spent - a.spent);
  const total = round2(rows.reduce((n, r) => n + r.spent, 0));
  return {
    currency: "USD",
    windowDays: WINDOW_DAYS,
    generatedAt: new Date().toISOString(),
    ledgerStatus: "pending",
    ceiling: NO_CEILING,
    rows,
    totals: { spent: total, confidence: rows.length > 0 ? "Estimated" : "N/A" },
  };
}

function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist/i.test(msg) || /no such table/i.test(msg);
}

export const spendRouter = router({
  summary: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
    await assertWorkspacePermission(input.workspaceId, ctx.user.id, "policies", "read");
    try {
      return await summarizeFromLedger(input.workspaceId);
    } catch (err) {
      // spend_ledger migration not yet applied — fall back honestly.
      if (isMissingRelation(err)) return summarizeFromTokenUsage(ctx.user.id);
      throw err;
    }
  }),
});
