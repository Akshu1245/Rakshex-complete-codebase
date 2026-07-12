import { describe, expect, it } from "vitest";
import { compareToBaseline, createBaseline, shouldFailCi } from "./baseline.js";

describe("risk baseline", () => {
  const baseline = createBaseline({
    id: "bl-1",
    workspaceId: "ws_a",
    assetId: "col_1",
    findings: [
      { fingerprint: "api.missing_auth|POST|/users", severity: "Critical", status: "open" },
      { fingerprint: "api.insecure_http|GET|/x", severity: "High", status: "open" },
    ],
  });

  it("detects new findings", () => {
    const cmp = compareToBaseline(baseline, [
      ...baseline.findings,
      { fingerprint: "api.ssrf|GET|/hook", severity: "Medium", status: "open" },
    ]);
    expect(cmp.summary.newCount).toBe(1);
    expect(cmp.newFindings[0]?.fingerprint).toContain("ssrf");
  });

  it("detects resolved findings", () => {
    const cmp = compareToBaseline(baseline, [
      { fingerprint: "api.missing_auth|POST|/users", severity: "Critical", status: "open" },
    ]);
    expect(cmp.summary.resolvedCount).toBe(1);
  });

  it("detects regression of previously resolved", () => {
    const withResolved = createBaseline({
      id: "bl-2",
      workspaceId: "ws_a",
      assetId: "col_1",
      findings: [{ fingerprint: "api.insecure_http|GET|/x", severity: "High", status: "resolved" }],
    });
    const cmp = compareToBaseline(withResolved, [
      { fingerprint: "api.insecure_http|GET|/x", severity: "High", status: "open" },
    ]);
    expect(cmp.summary.regressedCount).toBe(1);
    expect(shouldFailCi(cmp)).toBe(true);
  });

  it("fails gate on new High+", () => {
    const cmp = compareToBaseline(
      baseline,
      [...baseline.findings, { fingerprint: "new|POST|/admin", severity: "High", status: "open" }],
      { failOn: "High" },
    );
    expect(cmp.failsGate).toBe(true);
  });

  it("does not fail gate on new Low when failOn is High", () => {
    const cmp = compareToBaseline(
      baseline,
      [...baseline.findings, { fingerprint: "new|GET|/info", severity: "Low", status: "open" }],
      { failOn: "High" },
    );
    expect(cmp.failsGate).toBe(false);
    expect(cmp.summary.newCount).toBe(1);
  });

  it("detects severity increase", () => {
    const cmp = compareToBaseline(baseline, [
      { fingerprint: "api.missing_auth|POST|/users", severity: "Critical", status: "open" },
      { fingerprint: "api.insecure_http|GET|/x", severity: "Critical", status: "open" },
    ]);
    expect(cmp.summary.severityIncreasedCount).toBe(1);
  });
});
