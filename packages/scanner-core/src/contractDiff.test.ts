import { describe, expect, it } from "vitest";
import { diffOpenApiContracts } from "./contractDiff.js";

const document = (paths: Record<string, unknown>) => ({ openapi: "3.0.3", paths });
const op = (extra: Record<string, unknown> = {}) => ({
  responses: { "200": { description: "OK" } },
  ...extra,
});
const json = (props: Record<string, unknown>, required: string[] = []) => ({
  content: { "application/json": { schema: { type: "object", properties: props, required } } },
});

describe("diffOpenApiContracts", () => {
  it("detects a removed operation", () => {
    const result = diffOpenApiContracts(document({ "/users": { get: op() } }), document({}));
    expect(result.changes).toMatchObject([
      { kind: "operation_removed", method: "GET", path: "/users" },
    ]);
  });

  it("detects new required parameters including path-level parameter", () => {
    const before = document({ "/users/{id}": { get: op() } });
    const after = document({
      "/users/{id}": {
        parameters: [{ name: "id", in: "path", required: true }],
        get: op({ parameters: [{ name: "region", in: "query", required: true }] }),
      },
    });
    const kinds = diffOpenApiContracts(before, after).changes.map((change) => change.kind);
    expect(kinds).toEqual(["required_parameter_added", "required_parameter_added"]);
  });

  it("does not flag a newly optional parameter", () => {
    const before = document({ "/users": { get: op() } });
    const after = document({
      "/users": {
        get: op({ parameters: [{ name: "limit", in: "query", required: false }] }),
      },
    });
    expect(diffOpenApiContracts(before, after).changes).toEqual([]);
  });

  it("detects newly required body and request properties", () => {
    const before = document({
      "/orders": {
        post: op({ requestBody: json({ sku: { type: "string" } }) }),
      },
    });
    const after = document({
      "/orders": {
        post: op({
          requestBody: {
            ...json({ sku: { type: "string" }, quantity: { type: "integer" } }, ["quantity"]),
            required: true,
          },
        }),
      },
    });
    const kinds = diffOpenApiContracts(before, after).changes.map((change) => change.kind);
    expect(kinds).toEqual(["request_body_required", "required_request_property_added"]);
  });

  it("detects removed JSON 200 response properties", () => {
    const before = document({
      "/orders": {
        get: op({
          responses: {
            "200": {
              description: "OK",
              ...json({ id: { type: "string" }, total: { type: "number" } }),
            },
          },
        }),
      },
    });
    const after = document({
      "/orders": {
        get: op({
          responses: {
            "200": { description: "OK", ...json({ id: { type: "string" } }) },
          },
        }),
      },
    });
    const kinds = diffOpenApiContracts(before, after).changes.map((change) => change.kind);
    expect(kinds).toEqual(["response_property_removed"]);
  });

  it("fails closed on invalid input and unresolved operation references", () => {
    expect(() => diffOpenApiContracts({}, document({}))).toThrow(/OpenAPI/);
    expect(() =>
      diffOpenApiContracts(
        document({ "/u": { get: op() } }),
        document({ "/u": { get: { $ref: "#/components/x" } } }),
      ),
    ).toThrow(/Unsupported/);
  });

  it("reports its partial coverage even when no changes are found", () => {
    const unchanged = document({ "/u": { get: op() } });
    expect(diffOpenApiContracts(unchanged, unchanged)).toMatchObject({
      breaking: false,
      changes: [],
    });
    expect(diffOpenApiContracts(unchanged, unchanged).scope).toContain("NOT proof");
  });
});
