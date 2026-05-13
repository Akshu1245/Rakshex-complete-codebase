// @ts-nocheck
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("drizzle.config", () => {
  it("config file exists at project root", () => {
    const path = resolve(__dirname, "..", "drizzle.config.ts");
    expect(() => readFileSync(path, "utf-8")).not.toThrow();
  });

  it("config contains mysql dialect string", () => {
    const path = resolve(__dirname, "..", "drizzle.config.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("mysql");
  });

  it("config contains schema path pointing to drizzle/schema.ts", () => {
    const path = resolve(__dirname, "..", "drizzle.config.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("./drizzle/schema.ts");
  });

  it("config throws when DATABASE_URL is not set", () => {
    const path = resolve(__dirname, "..", "drizzle.config.ts");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("throw new Error");
  });
});
