import { describe, expect, it, vi } from "vitest";
import {
  planProviders,
  runAnthropicTick,
  runGoogleTick,
  type ReconciliationStore,
  type WorkerContext,
  type WorkerTarget,
  __test,
} from "./reconciliationWorker";

function memoryStore(): ReconciliationStore & { writes: unknown[]; rows: unknown[] } {
  const store: ReconciliationStore & { writes: unknown[]; rows: unknown[] } = {
    writes: [],
    rows: [],
    async persistRows(_ws, _acct, _provider, rows) {
      store.rows.push(...rows);
    },
    async ledgerSumUsd() {
      return 0;
    },
    async writeWindow(input) {
      store.writes.push(input);
    },
  };
  return store;
}

function ctxWith(env: Record<string, string | undefined>): WorkerContext & {
  store: ReturnType<typeof memoryStore>;
} {
  const store = memoryStore();
  return {
    env,
    onDrift: vi.fn(),
    log: vi.fn(),
    now: () => new Date("2026-09-25T12:00:00Z"),
    store,
  };
}

const target: WorkerTarget = { workspaceId: 1, providerAccountId: 2 };

describe("reconciliation worker", () => {
  it("disables every provider when no keys are configured", () => {
    const plans = planProviders({});
    expect(plans).toHaveLength(3);
    for (const plan of plans) {
      expect(plan.enabled).toBe(false);
      expect(plan.missingKeys.length).toBeGreaterThan(0);
    }
    expect(plans.find((p) => p.provider === "openai")!.missingKeys).toEqual(["OPENAI_ADMIN_KEY"]);
    expect(plans.find((p) => p.provider === "anthropic")!.missingKeys).toEqual([
      "ANTHROPIC_ADMIN_KEY",
    ]);
    expect(plans.find((p) => p.provider === "google")!.missingKeys).toEqual([
      "GOOGLE_BILLING_EXPORT_BUCKET",
      "GOOGLE_BILLING_EXPORT_OAUTH_TOKEN",
    ]);
  });

  it("enables providers individually as keys appear", () => {
    const plans = planProviders({ ANTHROPIC_ADMIN_KEY: "sk-ant-admin-test" });
    expect(plans.find((p) => p.provider === "anthropic")!.enabled).toBe(true);
    expect(plans.find((p) => p.provider === "openai")!.enabled).toBe(false);
    expect(plans.find((p) => p.provider === "google")!.enabled).toBe(false);
  });

  it("bounds the Anthropic cadence to the 5-15 minute range", () => {
    const fast = planProviders({ ANTHROPIC_ADMIN_KEY: "x", ANTHROPIC_CADENCE_MINUTES: "1" });
    const slow = planProviders({ ANTHROPIC_ADMIN_KEY: "x", ANTHROPIC_CADENCE_MINUTES: "999" });
    expect(fast.find((p) => p.provider === "anthropic")!.cadenceMs).toBe(5 * 60_000);
    expect(slow.find((p) => p.provider === "anthropic")!.cadenceMs).toBe(15 * 60_000);
  });

  it("skips the anthropic tick gracefully when the key is missing — no throw, no writes", async () => {
    const ctx = ctxWith({});
    const plan = planProviders({}).find((p) => p.provider === "anthropic")!;
    const outcome = await runAnthropicTick(target, plan, ctx);
    expect(outcome).toMatchObject({ provider: "anthropic", status: "skipped" });
    expect(outcome.missingKeys).toEqual(["ANTHROPIC_ADMIN_KEY"]);
    expect(ctx.store.rows).toHaveLength(0);
    expect(ctx.store.writes).toHaveLength(0);
    expect(ctx.onDrift).not.toHaveBeenCalled();
  });

  it("skips the google tick gracefully when the export is not configured", async () => {
    const ctx = ctxWith({});
    const plan = planProviders({}).find((p) => p.provider === "google")!;
    const outcome = await runGoogleTick(target, plan, ctx);
    expect(outcome).toMatchObject({ provider: "google", status: "skipped" });
    expect(ctx.store.rows).toHaveLength(0);
    expect(ctx.store.writes).toHaveLength(0);
  });

  it("computes drift against the shared 1% limit", () => {
    expect(__test.DRIFT_LIMIT).toBe(0.01);
    const drift = __test.calculateReconciliation(1.25, 1.0);
    expect(drift.status).toBe("drift");
    expect(drift.driftPct).toBeGreaterThan(0.01);
    const ok = __test.calculateReconciliation(1.005, 1.0);
    expect(ok.status).toBe("ok");
  });

  it("aligns cadence windows to exact boundaries", () => {
    const { start, end } = __test.alignWindow(new Date("2026-09-25T12:07:00Z"), 5 * 60_000);
    expect(start).toEqual(new Date("2026-09-25T12:00:00Z"));
    expect(end).toEqual(new Date("2026-09-25T12:05:00Z"));
  });

  it("labels every spend figure — provider observed, never exact", () => {
    const plans = planProviders({ ANTHROPIC_ADMIN_KEY: "x" });
    for (const plan of plans) {
      expect(plan.providerLabel).toBe("observed");
      expect(plan.providerLabel).not.toBe("exact");
    }
  });
});
