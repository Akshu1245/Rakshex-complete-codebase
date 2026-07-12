import { describe, expect, it } from "vitest";
import {
  buildReport,
  CONTROL_CATALOG,
  NON_CERTIFICATION_DISCLAIMER,
  exportAuditEvents,
} from "./index.js";

describe("compliance-engine", () => {
  it("shows controls without evidence as incomplete", () => {
    const report = buildReport(
      [{ controlId: "CTRL-AUTH-01", status: "implemented", evidenceIds: [], approvalHistory: [] }],
      [],
    );
    const auth = report.controls.find((c) => c.control.id === "CTRL-AUTH-01");
    expect(auth?.status).toBe("in_progress");
    expect(auth?.complete).toBe(false);
  });

  it("marks implemented when evidence exists", () => {
    const report = buildReport(
      [
        {
          controlId: "CTRL-AUTH-01",
          status: "implemented",
          evidenceIds: ["ev1"],
          approvalHistory: [],
        },
      ],
      [
        {
          id: "ev1",
          controlId: "CTRL-AUTH-01",
          title: "MFA enabled",
          collectedAt: new Date().toISOString(),
          source: "system",
          reference: "settings/mfa",
        },
      ],
    );
    const auth = report.controls.find((c) => c.control.id === "CTRL-AUTH-01");
    expect(auth?.status).toBe("implemented");
    expect(auth?.complete).toBe(true);
  });

  it("includes non-certification disclaimer", () => {
    const report = buildReport([], []);
    expect(report.disclaimer).toBe(NON_CERTIFICATION_DISCLAIMER);
    expect(report.disclaimer.toLowerCase()).toContain("not constitute");
    expect(report.disclaimer).not.toMatch(/certified|we are soc 2/i);
  });

  it("covers required frameworks in catalog", () => {
    const frameworks = new Set(CONTROL_CATALOG.flatMap((c) => c.frameworks));
    for (const f of [
      "owasp_api_top10",
      "owasp_llm_top10",
      "nist_ai_rmf",
      "iso_27001",
      "iso_42001",
      "soc2",
      "gdpr",
      "india_dpdp",
      "eu_ai_act",
    ]) {
      expect(frameworks.has(f as never)).toBe(true);
    }
  });

  it("exports audit events as NDJSON", () => {
    const out = exportAuditEvents([{ type: "login", at: "2025-01-01T00:00:00Z", actor: "u1" }]);
    expect(out).toContain('"type":"login"');
  });
});
