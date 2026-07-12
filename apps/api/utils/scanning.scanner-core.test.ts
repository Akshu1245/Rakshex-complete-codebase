import { describe, expect, it } from "vitest";
import { generateRealFindings, calculateRiskScore } from "./scanning";

describe("scanner-core wiring", () => {
  it("generates rule-backed findings", () => {
    const f = generateRealFindings({
      item: [
        {
          request: {
            method: "POST",
            url: "http://x.com/users/1?password=x",
            header: [],
          },
        },
      ],
    });
    expect(f.length).toBeGreaterThan(0);
    expect(f.some((x) => x.ruleId === "api.insecure_http")).toBe(true);
    expect(f.some((x) => x.ruleId === "api.missing_authentication")).toBe(true);
    expect(calculateRiskScore(f)).toBeGreaterThan(0);
  });
});
