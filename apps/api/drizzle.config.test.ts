// @ts-nocheck
/**
 * Drizzle config now lives under packages/database after monorepo move.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CONFIG_PATH = resolve(__dirname, "..", "..", "packages", "database", "drizzle.config.ts");

describe("drizzle.config (@rakshex/database)", () => {
  it("config file exists in packages/database", () => {
    expect(() => readFileSync(CONFIG_PATH, "utf-8")).not.toThrow();
  });

  it("config contains postgresql dialect string", () => {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    expect(content).toContain("postgresql");
  });

  it("config contains schema path pointing to drizzle/schema.ts", () => {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    expect(content).toContain("./drizzle/schema.ts");
  });

  it("config references DATABASE_URL", () => {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    expect(content).toContain("DATABASE_URL");
  });
});
