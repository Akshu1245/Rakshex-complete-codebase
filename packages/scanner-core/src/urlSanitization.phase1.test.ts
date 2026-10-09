import { describe, expect, it } from "vitest";
import { runScan } from "./engine.js";
import { redactUrlSecrets } from "./normalize.js";

describe("Postman URL privacy in deterministic reports", () => {
  it("removes credentials, query values and fragments", () => {
    const sanitized = redactUrlSecrets("http://alice:pass-123@example.test/orders?token=secret-456&page=7#private-789");
    expect(sanitized).not.toContain("pass-123");
    expect(sanitized).not.toContain("secret-456");
    expect(sanitized).not.toContain("private-789");
    expect(sanitized).toContain("token=[REDACTED]");
  });
  it("keeps rule detection while keeping secret values out of findings", () => {
    const raw = {
      item: [{ request: {
        method: "GET",
        url: "http://alice:secret-PASS@example.test/orders?password=secret-QUERY#secret-FRAGMENT",
        header: [],
      } }],
    };
    const findings = runScan(raw).findings;
    const serialized = JSON.stringify(findings);
    for (const sensitive of ["secret-PASS", "secret-QUERY", "secret-FRAGMENT"]) {
      expect(serialized).not.toContain(sensitive);
    }
    expect(findings.map((f) => f.ruleId)).toContain("api.insecure_http");
    expect(findings.map((f) => f.ruleId)).toContain("api.sensitive_data_in_query");
  });
});
