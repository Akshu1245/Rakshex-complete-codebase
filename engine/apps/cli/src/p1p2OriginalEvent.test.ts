import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createP1P2Report } from "./p1p2Bridge.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../test-fixtures/p1p2-orders");

describe("P1 original synthetic Orders acceptance", () => {
  it("verifies the original P1 hash pair and detects two POST candidates without leaking source", () => {
    const result = createP1P2Report(
      join(root, "change-event-orders.json"),
      join(root, "orders-old.yaml"),
      join(root, "orders-new.yaml"),
      join(root, "src"),
    );
    expect(result.schema).toBe("impact-report.v1");
    expect(result.privacy_mode).toBe(true);
    expect(result.spec_hashes_verified).toBe(true);
    expect(result.metrics.files_scanned).toBe(5);
    expect(result.metrics.candidate_matches).toBe(2);
    expect(result.metrics.dynamic_calls).toBe(1);
    expect(result.findings.filter(f => f.classification === "UNCERTAIN")).toHaveLength(2);
    expect(result.findings.filter(f => f.classification === "UNKNOWN")).toHaveLength(1);
    const exported = JSON.stringify(result);
    for (const sensitive of ["/v1/orders", "09-post-fetch.ts", "10-post-axios.ts", "synthetic-orders-v1-to-v2-post-2026-10-19"]) {
      expect(exported).not.toContain(sensitive);
    }
    expect(result.repair_allowed).toBe(false);
  });
});
