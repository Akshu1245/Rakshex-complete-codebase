import { describe, expect, it } from "vitest";
import {
  parseCollectionImport,
  secureParseYaml,
  secureParseJson,
  stripExternalRefs,
  redactSecrets,
  detectFormat,
  SAFE_SAMPLE_COLLECTIONS,
  ImportSecurityError,
  assertSafeStructure,
  MAX_RECURSION_DEPTH,
} from "./secureParse";

describe("secureParseYaml", () => {
  it("parses valid OpenAPI YAML", () => {
    const doc = secureParseYaml(`
openapi: "3.0.3"
info:
  title: Demo
  version: "1.0.0"
paths:
  /health:
    get:
      responses:
        "200":
          description: ok
`);
    expect((doc as { openapi: string }).openapi).toBe("3.0.3");
  });

  it("rejects YAML bombs with too many anchors", () => {
    const anchors = Array.from({ length: 60 }, (_, i) => `a${i}: &a${i} x`).join("\n");
    expect(() => secureParseYaml(anchors)).toThrow(ImportSecurityError);
  });

  it("rejects oversized documents", () => {
    const huge = "x: " + "a".repeat(3 * 1024 * 1024);
    expect(() => secureParseYaml(huge)).toThrow(/FILE_TOO_LARGE|exceeds/);
  });
});

describe("secureParseJson", () => {
  it("rejects malformed JSON without crashing", () => {
    expect(() => secureParseJson("{not json")).toThrow(ImportSecurityError);
  });

  it("rejects prototype pollution keys", () => {
    expect(() => assertSafeStructure(JSON.parse('{"__proto__": {"x": 1}}'))).toThrow(
      /PROTOTYPE|Prohibited/,
    );
  });
});

describe("stripExternalRefs", () => {
  it("blocks http $ref (SSRF prevention)", () => {
    const warnings: string[] = [];
    const out = stripExternalRefs(
      {
        components: {
          schemas: {
            User: { $ref: "https://evil.example.com/schema.json" },
          },
        },
      },
      warnings,
    ) as { components: { schemas: { User: { $ref: string } } } };
    expect(out.components.schemas.User.$ref).toBe("#/blocked-external-ref");
    expect(warnings.some((w) => w.includes("Blocked external"))).toBe(true);
  });

  it("keeps local JSON pointer refs", () => {
    const warnings: string[] = [];
    const out = stripExternalRefs({ $ref: "#/components/schemas/User" }, warnings) as {
      $ref: string;
    };
    expect(out.$ref).toBe("#/components/schemas/User");
    expect(warnings).toHaveLength(0);
  });
});

describe("redactSecrets", () => {
  it("redacts OpenAI-style keys", () => {
    const obj = { header: "sk-abcdefghijklmnopqrstuvwxyz123456" };
    const n = redactSecrets(obj);
    expect(n).toBeGreaterThan(0);
    expect(String(obj.header)).toContain("REDACTED");
    expect(String(obj.header)).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });
});

describe("detectFormat", () => {
  it("detects openapi3, swagger2, postman v2.1", () => {
    expect(detectFormat(SAFE_SAMPLE_COLLECTIONS.openapi3)).toBe("openapi3");
    expect(detectFormat(SAFE_SAMPLE_COLLECTIONS.swagger2)).toBe("swagger2");
    expect(detectFormat(SAFE_SAMPLE_COLLECTIONS.postman_v21)).toBe("postman_v2.1");
  });
});

describe("parseCollectionImport", () => {
  it("imports Postman JSON", () => {
    const r = parseCollectionImport(JSON.stringify(SAFE_SAMPLE_COLLECTIONS.postman_v21), {
      filename: "api.json",
    });
    expect(r.errors).toHaveLength(0);
    expect(r.format).toBe("postman_v2.1");
    expect(r.endpointCount).toBe(1);
    expect(r.contentHash).toHaveLength(64);
  });

  it("imports OpenAPI YAML via _rawYaml wrapper (web client path)", () => {
    const yaml = `openapi: "3.0.3"\ninfo:\n  title: Wrapped\n  version: "1"\npaths: {}\n`;
    const r = parseCollectionImport(JSON.stringify({ _rawYaml: yaml }), {
      filename: "spec.json",
    });
    expect(r.errors).toHaveLength(0);
    expect(r.format).toBe("openapi3");
    expect(r.name).toBe("Wrapped");
  });

  it("returns errors for empty garbage without throwing", () => {
    const r = parseCollectionImport("not-json-or-yaml", { filename: "x.json" });
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("does not fetch remote refs", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "R", version: "1" },
      paths: {},
      components: { schemas: { A: { $ref: "https://attacker.test/x.json" } } },
    };
    const r = parseCollectionImport(JSON.stringify(doc), { filename: "x.json" });
    expect(r.warnings.some((w) => w.includes("Blocked external"))).toBe(true);
  });
});

describe("depth limit", () => {
  it("rejects deep nesting", () => {
    let o: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < MAX_RECURSION_DEPTH + 5; i++) {
      o = { nested: o };
    }
    expect(() => assertSafeStructure(o)).toThrow(/depth/i);
  });
});
