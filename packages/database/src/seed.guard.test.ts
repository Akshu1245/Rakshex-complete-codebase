import { describe, expect, it } from "vitest";
import { assertSeedEnvironment } from "./seed";

describe("database seed environment guard", () => {
  it("allows development and test environments", () => {
    expect(() => assertSeedEnvironment("development")).not.toThrow();
    expect(() => assertSeedEnvironment("test")).not.toThrow();
  });

  it("refuses production by default", () => {
    expect(() => assertSeedEnvironment("production")).toThrow(/Refusing to seed/);
  });

  it("refuses unspecified and staging environments", () => {
    expect(() => assertSeedEnvironment("")).toThrow(/Refusing to seed/);
    expect(() => assertSeedEnvironment("staging")).toThrow(/Refusing to seed/);
  });
});
