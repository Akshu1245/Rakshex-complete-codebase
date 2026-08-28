import { describe, expect, it } from "vitest";
import { assertSeedEnvironment, PRODUCTION_SEED_CONFIRMATION } from "./seed";

describe("database seed environment guard", () => {
  it("allows development and test environments", () => {
    expect(() => assertSeedEnvironment("development")).not.toThrow();
    expect(() => assertSeedEnvironment("test")).not.toThrow();
  });

  it("refuses production by default", () => {
    expect(() => assertSeedEnvironment("production")).toThrow(/Refusing to seed/);
  });

  it("requires the exact explicit production confirmation", () => {
    expect(() => assertSeedEnvironment("production", "yes")).toThrow(/Refusing to seed/);
    expect(() =>
      assertSeedEnvironment("production", PRODUCTION_SEED_CONFIRMATION),
    ).not.toThrow();
  });
});
