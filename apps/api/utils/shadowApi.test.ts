import { describe, expect, it } from "vitest";
import { detectShadowAPIs } from "./scanning";

describe("detectShadowAPIs", () => {
  it("flags destructive admin/internal endpoints from a Postman collection", () => {
    const shadows = detectShadowAPIs({
      item: [
        { request: { method: "DELETE", url: { raw: "http://api.local/admin/users/5" } } },
        { request: { method: "GET", url: { raw: "http://api.local/internal/debug" } } },
        { request: { method: "GET", url: { raw: "http://api.local/api/v1/users" } } },
      ],
    });
    const paths = shadows.map((s) => s.endpoint);
    expect(paths).toContain("/admin/users/5");
    expect(paths).toContain("/internal/debug");
    // Well-versioned, non-risky endpoint should not be flagged.
    expect(paths).not.toContain("/api/v1/users");
    const adminOp = shadows.find((s) => s.endpoint === "/admin/users/5");
    expect(adminOp?.riskLevel).toBe("CRITICAL");
  });

  it("also discovers shadow endpoints from an OpenAPI paths object", () => {
    const shadows = detectShadowAPIs({
      paths: {
        "/internal/metrics": { get: {} },
        "/api/v1/orders": { get: {} },
      },
    });
    const paths = shadows.map((s) => s.endpoint);
    expect(paths).toContain("/internal/metrics");
    expect(paths).not.toContain("/api/v1/orders");
  });

  it("returns nothing for a clean, versioned collection", () => {
    const shadows = detectShadowAPIs({
      item: [{ request: { method: "GET", url: { raw: "http://api.local/api/v2/health" } } }],
    });
    expect(shadows).toHaveLength(0);
  });
});
