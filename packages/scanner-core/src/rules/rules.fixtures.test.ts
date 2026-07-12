/**
 * Positive + negative fixture tests for every registered rule.
 */
import { describe, expect, it } from "vitest";
import { runScan } from "../engine.js";
import { listRuleIds, getRuleById, DEFAULT_RULES } from "./registry.js";

/** Vulnerable fixtures — must trigger the rule */
const POSITIVE: Record<string, unknown> = {
  "api.insecure_http": {
    item: [
      {
        name: "insecure",
        request: { method: "GET", url: "http://api.example.com/x", header: [] },
      },
    ],
  },
  "api.missing_authentication": {
    item: [
      {
        name: "write",
        request: {
          method: "POST",
          url: "https://api.example.com/users",
          header: [],
        },
      },
    ],
  },
  "api.idor_sequential_id": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users/12345",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "api.sensitive_data_in_query": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/login?password=secret",
          header: [],
        },
      },
    ],
  },
  "api.debug_headers": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/x",
          header: [{ key: "X-Debug-Trace", value: "1" }],
        },
      },
    ],
  },
  "api.missing_correlation_id": {
    item: [
      {
        request: {
          method: "POST",
          url: "https://api.example.com/orders",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "api.ssrf_risk_indicator": {
    item: [
      {
        request: {
          method: "POST",
          url: "https://api.example.com/fetch?url=https://evil.test",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "ai.prompt_injection_surface": {
    item: [
      {
        name: "chat prompt",
        request: {
          method: "POST",
          url: "https://api.example.com/v1/chat/completions",
          header: [{ key: "Content-Type", value: "application/json" }],
        },
      },
    ],
  },
  "ai.excessive_agency": {
    item: [
      {
        name: "agent shell exec",
        request: {
          method: "POST",
          url: "https://api.example.com/agent/tools/invoke",
          header: [],
        },
      },
    ],
  },
  "ai.insecure_plugin_output": {
    item: [
      {
        name: "plugin result",
        request: {
          method: "GET",
          url: "https://api.example.com/mcp/tool-output",
          header: [],
        },
      },
    ],
  },
};

/** Secure fixtures — must NOT trigger the rule */
const NEGATIVE: Record<string, unknown> = {
  "api.insecure_http": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/x",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "api.missing_authentication": {
    item: [
      {
        request: {
          method: "POST",
          url: "https://api.example.com/users",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "api.idor_sequential_id": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users/me",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "api.sensitive_data_in_query": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/login?redirect=/home",
          header: [],
        },
      },
    ],
  },
  "api.debug_headers": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/x",
          header: [{ key: "Accept", value: "application/json" }],
        },
      },
    ],
  },
  "api.missing_correlation_id": {
    item: [
      {
        request: {
          method: "POST",
          url: "https://api.example.com/orders",
          header: [
            { key: "Authorization", value: "Bearer t" },
            { key: "X-Request-Id", value: "abc" },
          ],
        },
      },
    ],
  },
  "api.ssrf_risk_indicator": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/users",
          header: [{ key: "Authorization", value: "Bearer t" }],
        },
      },
    ],
  },
  "ai.prompt_injection_surface": {
    item: [
      {
        name: "health",
        request: {
          method: "GET",
          url: "https://api.example.com/health",
          header: [],
        },
      },
    ],
  },
  "ai.excessive_agency": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/health",
          header: [],
        },
      },
    ],
  },
  "ai.insecure_plugin_output": {
    item: [
      {
        request: {
          method: "GET",
          url: "https://api.example.com/health",
          header: [],
        },
      },
    ],
  },
};

describe("rule registry completeness", () => {
  it("every rule has required metadata", () => {
    for (const rule of DEFAULT_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.category).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.severity).toBeTruthy();
      expect(rule.confidence).toBeTruthy();
      expect(rule.version).toBeTruthy();
      expect(rule.standards).toBeTruthy();
      expect(typeof rule.evaluate).toBe("function");
    }
  });

  it("listRuleIds matches DEFAULT_RULES", () => {
    expect(listRuleIds().sort()).toEqual(DEFAULT_RULES.map((r) => r.id).sort());
  });
});

describe("positive fixtures", () => {
  for (const ruleId of listRuleIds()) {
    it(`${ruleId} fires on vulnerable fixture`, () => {
      const fixture = POSITIVE[ruleId];
      expect(fixture, `missing positive fixture for ${ruleId}`).toBeTruthy();
      const result = runScan(fixture, { onlyRuleIds: [ruleId] });
      expect(result.findings.some((f) => f.ruleId === ruleId)).toBe(true);
      for (const f of result.findings) {
        expect(f.evidence.length).toBeGreaterThan(0);
        expect(f.fingerprint).toContain(ruleId);
      }
    });
  }
});

describe("negative fixtures", () => {
  for (const ruleId of listRuleIds()) {
    it(`${ruleId} stays quiet on secure fixture`, () => {
      const fixture = NEGATIVE[ruleId];
      expect(fixture, `missing negative fixture for ${ruleId}`).toBeTruthy();
      const result = runScan(fixture, { onlyRuleIds: [ruleId] });
      expect(result.findings.filter((f) => f.ruleId === ruleId)).toHaveLength(0);
    });
  }
});

describe("determinism", () => {
  it("same input → same fingerprints", () => {
    const a = runScan(POSITIVE["api.insecure_http"]);
    const b = runScan(POSITIVE["api.insecure_http"]);
    expect(a.findings.map((f) => f.fingerprint).sort()).toEqual(
      b.findings.map((f) => f.fingerprint).sort(),
    );
  });

  it("handles empty / malformed without throw", () => {
    expect(() => runScan(null)).not.toThrow();
    expect(() => runScan({})).not.toThrow();
    expect(() => runScan("string")).not.toThrow();
    expect(runScan({}).findings).toEqual([]);
  });
});

describe("getRuleById", () => {
  it("returns metadata for known rules", () => {
    expect(getRuleById("api.insecure_http")?.severity).toBe("High");
  });
});
