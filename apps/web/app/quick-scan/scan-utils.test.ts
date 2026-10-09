import { describe, expect, it } from "vitest";
import { parseQuickScanInput, scanLocally, reportAsMarkdown, MAX_INPUT_BYTES } from "./scan-utils";

const postman = (url: string) =>
  JSON.stringify({
    info: { name: "Test collection" },
    item: [{ request: { method: "GET", url, header: [] } }],
  });

describe("browser-local static Quick Scan", () => {
  it("detects a cleartext Postman request", () => {
    const result = scanLocally(postman("http://example.test/orders?password=not-a-real-secret"));
    expect(result.endpointCount).toBe(1);
    expect(result.findings.some((f) => f.ruleId === "api.insecure_http")).toBe(true);
    expect(result.findings.some((f) => f.ruleId === "api.sensitive_data_in_query")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("not-a-real-secret");
  });

  it("parses an OpenAPI YAML spec with the same deterministic scanner", () => {
    const yaml = "openapi: 3.0.3\npaths:\n  /orders:\n    post: {}\n";
    const result = scanLocally(yaml, "openapi.yaml");
    expect(result.inputFormat).toBe("yaml");
    expect(result.findings.some((f) => f.ruleId === "api.missing_authentication")).toBe(true);
  });

  it("rejects unrelated JSON instead of returning a clean report", () => {
    expect(() => scanLocally('{"hello":"world"}', "other.json")).toThrow(/Postman|OpenAPI/);
  });

  it("rejects an empty API collection instead of reporting secure", () => {
    expect(() => scanLocally('{"item":[]}', "collection.json")).toThrow(/No API operations/);
  });

  it("rejects malformed JSON/YAML and overly large text", () => {
    expect(() => parseQuickScanInput("{invalid", "bad.json")).toThrow(/Invalid JSON/);
    expect(() => parseQuickScanInput("openapi: [unclosed", "bad.yaml")).toThrow(/Invalid YAML/);
    expect(() => parseQuickScanInput("x".repeat(MAX_INPUT_BYTES + 1), "over.json")).toThrow(
      /5 MiB/,
    );
  });

  it("produces a markdown report without the raw input", () => {
    const result = scanLocally(postman("https://example.test/api?token=test-only-value"));
    const md = reportAsMarkdown(result);
    expect(md).toContain("Static API Findings");
    expect(md).toContain("Recommendation");
    expect(md).not.toContain("test-only-value");
  });

  it("does not fabricate an exploit verdict for heuristics", () => {
    const result = scanLocally(postman("https://example.test/users/123"));
    expect(result.limitation).toMatch(/not confirmation/i);
  });
});
