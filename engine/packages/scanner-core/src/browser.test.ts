import { describe, expect, it } from "vitest";
import { runScan, getRiskLevel } from "./browser.js";

describe("browser-safe scanner entrypoint", () => {
  it("uses the shared deterministic rules instead of a second scanner", () => {
    const doc = { paths: { "/orders": { post: {} } } };
    const first = runScan(doc);
    const second = runScan(doc);
    expect(first.rulesRun).toEqual(second.rulesRun);
    expect(first.findings.map((f) => [f.ruleId, f.severity, f.endpoint])).toEqual(
      second.findings.map((f) => [f.ruleId, f.severity, f.endpoint]),
    );
    expect(first.findings.some((f) => f.ruleId === "api.missing_authentication")).toBe(true);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(getRiskLevel(20));
  });
});
