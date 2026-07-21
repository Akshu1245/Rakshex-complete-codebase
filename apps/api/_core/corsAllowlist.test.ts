import { describe, expect, it } from "vitest";
import { buildCorsAllowlist } from "./corsAllowlist";

describe("buildCorsAllowlist", () => {
  it("production list is explicit origins only (no vercel/insforge wildcards)", () => {
    const list = buildCorsAllowlist({
      isProduction: true,
      frontendUrl: "https://app.rakshex.in",
      corsOrigins: "",
    });

    expect(list).toContain("https://rakshex.in");
    expect(list).toContain("https://www.rakshex.in");
    expect(list).toContain("https://yc7y9pq9.insforge.site");
    expect(list).toContain("https://app.devpulse.ai");
    expect(list).toContain("https://app.rakshex.in");

    for (const origin of list) {
      expect(origin).not.toMatch(/\*/);
      expect(origin).not.toMatch(/vercel\.app/i);
    }
    // Exact InsForge production origin is allowed; wildcards are not.
    expect(list.some((o) => o.includes("*") && o.toLowerCase().includes("insforge"))).toBe(false);
  });

  it("merges comma-separated CORS_ORIGINS without introducing wildcards", () => {
    const list = buildCorsAllowlist({
      isProduction: true,
      frontendUrl: "https://app.rakshex.in",
      corsOrigins: "https://staging.rakshex.in, https://preview.example.com",
    });

    expect(list).toContain("https://staging.rakshex.in");
    expect(list).toContain("https://preview.example.com");
    expect(list.every((o) => !o.includes("*"))).toBe(true);
  });

  it("dev allowlist includes localhost ports and FRONTEND_URL", () => {
    const list = buildCorsAllowlist({
      isProduction: false,
      frontendUrl: "http://localhost:4000",
      corsOrigins: "",
    });

    expect(list).toContain("http://localhost:3000");
    expect(list).toContain("http://localhost:5173");
    expect(list).toContain("http://localhost:4000");
  });

  it("deduplicates overlapping FRONTEND_URL and CORS_ORIGINS", () => {
    const list = buildCorsAllowlist({
      isProduction: true,
      frontendUrl: "https://rakshex.in",
      corsOrigins: "https://rakshex.in,https://www.rakshex.in",
    });

    expect(list.filter((o) => o === "https://rakshex.in")).toHaveLength(1);
    expect(list.filter((o) => o === "https://www.rakshex.in")).toHaveLength(1);
  });
});
