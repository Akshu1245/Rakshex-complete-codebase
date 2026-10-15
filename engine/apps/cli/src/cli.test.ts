import { describe, expect, it } from "vitest";
import { runScan, listRuleIds } from "@rakshex/scanner-core";

describe("@rakshex/cli offline scan path", () => {
  it("scanner-core is available for offline mode", () => {
    expect(listRuleIds().length).toBeGreaterThan(0);
  });

  it("scan produces deterministic findings for insecure http fixture", () => {
    const doc = {
      item: [
        {
          request: {
            method: "GET",
            url: "http://api.example.com/x",
            header: [],
          },
        },
      ],
    };
    const a = runScan(doc);
    const b = runScan(doc);
    expect(a.findings.map((f) => f.fingerprint).sort()).toEqual(
      b.findings.map((f) => f.fingerprint).sort(),
    );
    expect(a.findings.some((f) => f.ruleId === "api.insecure_http")).toBe(true);
  });
});
