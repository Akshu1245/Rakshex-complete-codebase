import { describe, expect, it } from "vitest";
import { __test } from "./env";

describe("production environment secret placeholders", () => {
  it("recognizes every built in production secret placeholder as unsafe", () => {
    expect(
      __test.isUnsafeProductionPlaceholder(
        "JWT_SECRET",
        "production-jwt-secret-min-32-chars-long-rakshex-001",
      ),
    ).toBe(true);
    expect(__test.isUnsafeProductionPlaceholder("SMTP_PASS", "placeholder-smtp-pass")).toBe(true);
    expect(
      __test.isUnsafeProductionPlaceholder(
        "METRICS_TOKEN",
        "rakshex-metrics-token-16chars-minimum",
      ),
    ).toBe(true);
    expect(
      __test.isUnsafeProductionPlaceholder(
        "GITHUB_WEBHOOK_SECRET",
        "rakshex-github-webhook-secret",
      ),
    ).toBe(true);
  });

  it("does not reject a distinct operator supplied secret", () => {
    expect(
      __test.isUnsafeProductionPlaceholder(
        "JWT_SECRET",
        "a-unique-operator-supplied-production-secret-48-chars",
      ),
    ).toBe(false);
  });
});
