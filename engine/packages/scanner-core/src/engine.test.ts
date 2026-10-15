import { describe, expect, it } from "vitest";
import { calculateRiskScore, getRiskLevel, runScan, toLegacyFindings } from "./engine.js";
import { listRuleIds } from "./rules/registry.js";
import { normalizeCollection } from "./normalize.js";

const samplePostman = {
  item: [
    {
      name: "Create user",
      request: {
        method: "POST",
        url: "http://api.example.com/users/42?password=secret&callback=https://evil.test",
        header: [{ key: "X-Debug-Trace", value: "1" }],
      },
    },
    {
      name: "List public",
      request: {
        method: "GET",
        url: "https://api.example.com/public/health",
        header: [],
      },
    },
  ],
};

const sampleOpenApi = {
  paths: {
    "/orders": {
      post: {
        parameters: [],
      },
      get: {
        security: [{ bearerAuth: [] }],
      },
    },
  },
};

describe("normalizeCollection", () => {
  it("parses postman items", () => {
    const n = normalizeCollection(samplePostman);
    expect(n.format).toBe("postman");
    expect(n.endpoints).toHaveLength(2);
    expect(n.endpoints[0]?.method).toBe("POST");
    expect(n.endpoints[0]?.queryKeys).toContain("password");
  });

  it("parses openapi paths", () => {
    const n = normalizeCollection(sampleOpenApi);
    expect(n.format).toBe("openapi");
    expect(n.endpoints.some((e) => e.method === "POST" && !e.hasDeclaredSecurity)).toBe(true);
  });
});

describe("runScan", () => {
  it("emits high-signal findings with rule ids", () => {
    const result = runScan(samplePostman);
    expect(result.endpointCount).toBe(2);
    expect(result.rulesRun.length).toBe(listRuleIds().length);
    expect(result.findings.length).toBeGreaterThan(0);

    const ruleIds = new Set(result.findings.map((f) => f.ruleId));
    expect(ruleIds.has("api.insecure_http")).toBe(true);
    expect(ruleIds.has("api.missing_authentication")).toBe(true);
    expect(ruleIds.has("api.sensitive_data_in_query")).toBe(true);
    expect(ruleIds.has("api.ssrf_risk_indicator")).toBe(true);
    expect(ruleIds.has("api.idor_sequential_id")).toBe(true);

    for (const f of result.findings) {
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.fingerprint).toContain(f.ruleId);
    }
  });

  it("flags openapi mutating ops without security", () => {
    const result = runScan(sampleOpenApi);
    const missing = result.findings.filter((f) => f.ruleId === "api.missing_authentication");
    expect(missing.some((f) => f.method === "POST")).toBe(true);
    expect(missing.some((f) => f.method === "GET")).toBe(false);
  });

  it("maps to legacy finding shape", () => {
    let i = 0;
    const legacy = toLegacyFindings(runScan(samplePostman).findings, () => `id-${++i}`);
    expect(legacy[0]?.id).toMatch(/^id-/);
    expect(legacy[0]?.cweId).toMatch(/^CWE-/);
    expect(legacy[0]?.ruleId).toBeTruthy();
  });

  it("scores risk consistently", () => {
    const findings = runScan(samplePostman).findings;
    const score = calculateRiskScore(findings);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(getRiskLevel(score));
  });

  it("returns empty findings for empty input", () => {
    const result = runScan({});
    expect(result.findings).toEqual([]);
    expect(result.endpointCount).toBe(0);
  });
});
