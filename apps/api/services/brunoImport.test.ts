import { describe, it, expect } from "vitest";
import { parseBrunoCollection } from "./brunoImport";

describe("brunoImport", () => {
  it("parses a valid Bruno collection export", () => {
    const collection = {
      name: "Test API",
      version: "1",
      items: [
        {
          name: "Get Users",
          method: "GET",
          url: "https://api.example.com/users",
          headers: [{ name: "Accept", value: "application/json" }],
        },
        {
          name: "Create User",
          method: "POST",
          url: "https://api.example.com/users",
          headers: [
            { name: "Content-Type", value: "application/json" },
            { name: "Authorization", value: "Bearer secret-token-12345" },
          ],
          body: '{"name":"test"}',
        },
      ],
    };

    const result = parseBrunoCollection(JSON.stringify(collection));

    expect(result.name).toBe("Test API");
    expect(result.totalRequests).toBe(2);
    expect(result.requests[0].method).toBe("GET");
    expect(result.requests[0].url).toBe("https://api.example.com/users");
    expect(result.requests[1].method).toBe("POST");
    expect(result.requests[1].headers["Authorization"]).toBe("Bearer secret-token-12345");
  });

  it("detects secrets in headers and warns", () => {
    const collection = {
      name: "Secrets Test",
      items: [
        {
          name: "API Call",
          method: "GET",
          url: "https://api.example.com/data",
          headers: [{ name: "X-Api-Key", value: "sk_live_abcdef123456" }],
        },
      ],
    };

    const result = parseBrunoCollection(JSON.stringify(collection));
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("secret");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseBrunoCollection("not json")).toThrow("not valid JSON");
  });

  it("handles missing items gracefully", () => {
    const result = parseBrunoCollection(JSON.stringify({ name: "Empty" }));
    expect(result.totalRequests).toBe(0);
  });

  it("normalizes HTTP methods to uppercase", () => {
    const collection = {
      name: "Method Test",
      items: [
        { name: "A", method: "post", url: "https://a.com" },
        { name: "B", method: "INVALID", url: "https://b.com" },
      ],
    };

    const result = parseBrunoCollection(JSON.stringify(collection));
    expect(result.requests[0].method).toBe("POST");
    expect(result.requests[1].method).toBe("GET"); // fallback for invalid
  });
});
