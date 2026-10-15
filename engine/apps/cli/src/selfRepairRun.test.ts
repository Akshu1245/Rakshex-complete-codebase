import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repairFromContractChanges, STRIPE_ENDIVE_RULES } from "./selfRepairRun.js";

const bench = join(__dirname, "..", "bench", "self-repair");
const changes = JSON.parse(readFileSync(join(bench, "fixtures", "stripe-v2516-v2517.subset.json"), "utf8")).changes;
const ws = () => { const d = mkdtempSync(join(tmpdir(), "sr-e2e-")); cpSync(join(bench, "repos", "endive-acceptance"), d, { recursive: true }); return d; };
const base = { title: "t", repo: "o/r", baseSha: "x", workspaceId: "w", rules: STRIPE_ENDIVE_RULES, checks: [{ name: "noop", cmd: process.execPath, args: ["-e", "0"], cwd: tmpdir() }] };

describe("cli -> @rakshex/self-repair end to end", () => {
  it("acceptance repo: card-only checkout is patched; semantic warning forces human review (STOPPED)", () => {
    const d = ws();
    const r = repairFromContractChanges(d, changes, base);
    expect(r.assessments.length).toBeGreaterThan(0);
    expect(r.assessments.every((a) => a.impact.change.path === "/v1/checkout/sessions")).toBe(true);
    // The Endive note (allowed_ filters silently) is a documented behaviour change -> HIGH -> STOPPED.
    expect(r.status).toBe("STOPPED_NEEDS_REVIEW");
    expect(r.patch?.diff).toMatch(/\+\s*allowed_payment_method_types: \['card'\]/);
    expect(readFileSync(join(d, "src/payments/checkout.ts"), "utf8")).toMatch(/allowed_payment_method_types/);
  });
});
