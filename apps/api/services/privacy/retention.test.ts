import { describe, expect, it } from "vitest";
import { anonymizeUserRecord, networkTelemetryAllowed, shouldStoreTelemetry } from "./retention";

describe("privacy retention", () => {
  it("anonymizes email/name on deletion", () => {
    const row = anonymizeUserRecord({
      id: 1,
      email: "user@example.com",
      name: "Ada",
    }) as { email: string; anonymized?: boolean; deletedAt?: string };
    expect(row.email).not.toContain("user@example.com");
    expect(String(row.email)).toMatch(/^anon_/);
    expect(row.anonymized).toBe(true);
    expect(row.deletedAt).toBeTruthy();
  });

  it("zero_retention and local_only do not ship network telemetry storage", () => {
    expect(shouldStoreTelemetry("standard")).toBe(true);
    expect(shouldStoreTelemetry("zero_retention")).toBe(false);
    expect(networkTelemetryAllowed("local_only")).toBe(false);
    expect(networkTelemetryAllowed("zero_retention")).toBe(false);
  });
});
