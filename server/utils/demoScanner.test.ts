import { describe, expect, it } from "vitest";
import { performDemoScan } from "./demoScanner";

describe("performDemoScan", () => {
  it("returns an empty, high-scoring result for a clean collection", () => {
    const result = performDemoScan({
      item: [
        {
          name: "Get profile",
          request: {
            url: "https://api.example.com/me",
            method: "GET",
            header: [{ key: "Authorization" }],
          },
        },
      ],
    });
    expect(result.findings).toHaveLength(0);
    expect(result.credentials).toHaveLength(0);
    expect(result.endpoints).toEqual(["GET https://api.example.com/me"]);
    expect(result.owaspScore).toBe(100);
    expect(result.pciScore).toBe(100);
  });

  it("flags insecure HTTP and missing auth", () => {
    const result = performDemoScan({
      item: [
        { name: "Insecure", request: { url: "http://api.example.com/data", method: "GET", header: [] } },
      ],
    });
    const titles = result.findings.map((f) => f.title);
    expect(titles).toContain("Insecure HTTP endpoint detected");
    expect(titles).toContain("Missing authentication header");
  });

  it("detects an exposed OpenAI key as a critical credential leak", () => {
    const leaked = "sk-" + "a".repeat(48);
    const result = performDemoScan({
      item: [
        {
          name: "Leaky",
          request: {
            url: "https://api.example.com/x",
            method: "POST",
            header: [{ key: "Authorization" }],
            body: { raw: `{"key":"${leaked}"}` },
          },
        },
      ],
    });
    expect(result.credentials.length).toBeGreaterThan(0);
    expect(result.credentials[0].type).toBe("OpenAI API Key");
    expect(result.findings.some((f) => f.severity === "Critical")).toBe(true);
    expect(result.owaspScore).toBeLessThan(100);
  });

  it("recurses into nested folders", () => {
    const result = performDemoScan({
      item: [
        {
          name: "Folder",
          item: [
            { name: "Child", request: { url: "http://nested.example.com", method: "GET", header: [] } },
          ],
        },
      ],
    });
    expect(result.endpoints).toContain("GET http://nested.example.com");
  });
});
