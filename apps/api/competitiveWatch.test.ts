// @ts-nocheck
import { describe, expect, it } from "vitest";

describe("competitiveWatch", () => {
  it("exports DEFAULT_COMPETITORS with helicone as direct competitor", async () => {
    const { DEFAULT_COMPETITORS } = await import("./services/research/competitiveWatch");
    expect(DEFAULT_COMPETITORS).toBeInstanceOf(Array);
    const helicone = DEFAULT_COMPETITORS.find((c: any) => c.id === "helicone");
    expect(helicone).toBeDefined();
    expect(helicone.category).toBe("direct");
    expect(helicone.priority).toBe(1);
    expect(helicone.websiteUrl).toBe("https://helicone.ai");
  }, 30_000);

  it("has at least 4 competitors tracked", async () => {
    const { DEFAULT_COMPETITORS } = await import("./services/research/competitiveWatch");
    expect(DEFAULT_COMPETITORS.length).toBeGreaterThanOrEqual(4);
  }, 30_000);

  it("all competitors have required fields", async () => {
    const { DEFAULT_COMPETITORS } = await import("./services/research/competitiveWatch");
    for (const c of DEFAULT_COMPETITORS as any[]) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.websiteUrl).toBeTruthy();
      expect(c.category).toMatch(/^(direct|adjacent|emerging)$/);
      expect(c.priority).toBeGreaterThanOrEqual(1);
      expect(c.priority).toBeLessThanOrEqual(3);
    }
  });

  it("runs a scan on all competitors", async () => {
    const { scanAllCompetitors } = await import("./services/research/competitiveWatch");
    const result = await scanAllCompetitors();
    expect(result).toBeInstanceOf(Array);
  });
});
