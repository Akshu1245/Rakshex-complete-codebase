// @ts-nocheck
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { initTRPC } from "@trpc/server";

import { buildOpenApiSpec, walkRouter, zodToJsonSchema } from "./openapiGenerator";

const t = initTRPC.create();

describe("zodToJsonSchema", () => {
  it("converts primitives", () => {
    expect(zodToJsonSchema(z.string())).toEqual({ type: "string" });
    expect(zodToJsonSchema(z.number())).toEqual({ type: "number" });
    expect(zodToJsonSchema(z.boolean())).toEqual({ type: "boolean" });
    expect(zodToJsonSchema(z.date())).toEqual({
      type: "string",
      format: "date-time",
    });
    expect(zodToJsonSchema(z.null())).toEqual({ type: "null" });
  });

  it("converts enums", () => {
    const schema = z.enum(["a", "b", "c"]);
    expect(zodToJsonSchema(schema)).toEqual({
      type: "string",
      enum: ["a", "b", "c"],
    });
  });

  it("converts literals", () => {
    expect(zodToJsonSchema(z.literal("hello"))).toEqual({ const: "hello" });
    expect(zodToJsonSchema(z.literal(42))).toEqual({ const: 42 });
    expect(zodToJsonSchema(z.literal(true))).toEqual({ const: true });
  });

  it("unwraps optional / nullable / default", () => {
    expect(zodToJsonSchema(z.string().optional())).toEqual({ type: "string" });
    expect(zodToJsonSchema(z.number().nullable())).toEqual({ type: "number" });
    expect(zodToJsonSchema(z.boolean().default(false))).toEqual({
      type: "boolean",
    });
  });

  it("converts arrays", () => {
    const result = zodToJsonSchema(z.array(z.string()));
    expect(result).toEqual({ type: "array", items: { type: "string" } });
  });

  it("converts objects with required and optional fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const result = zodToJsonSchema(schema) as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
    expect(result.type).toBe("object");
    expect(result.properties).toEqual({
      name: { type: "string" },
      age: { type: "number" },
    });
    expect(result.required).toEqual(["name"]);
  });

  it("converts unions", () => {
    const schema = z.union([z.string(), z.number()]);
    const result = zodToJsonSchema(schema) as { oneOf: unknown[] };
    expect(result.oneOf).toHaveLength(2);
  });
});

describe("walkRouter", () => {
  it("yields every leaf procedure with dotted paths", () => {
    const inner = t.router({
      ping: t.procedure.query(() => "pong"),
      hello: t.procedure.input(z.object({ name: z.string() })).mutation(() => "ok"),
    });
    const root = t.router({
      health: t.procedure.query(() => "ok"),
      api: inner,
    });
    const procs = walkRouter(root);
    const paths = procs.map((p) => p.path).sort();
    expect(paths).toContain("health");
    expect(paths).toContain("api.ping");
    expect(paths).toContain("api.hello");
  });

  it("identifies query vs mutation correctly", () => {
    const root = t.router({
      readSomething: t.procedure.query(() => "ok"),
      writeSomething: t.procedure.mutation(() => "ok"),
    });
    const procs = walkRouter(root);
    const types = Object.fromEntries(procs.map((p) => [p.path, p.type]));
    expect(types.readSomething).toBe("query");
    expect(types.writeSomething).toBe("mutation");
  });
});

describe("buildOpenApiSpec", () => {
  const sampleRouter = t.router({
    health: t.procedure.query(() => ({ status: "ok" })),
    items: t.router({
      list: t.procedure.input(z.object({ limit: z.number().optional() })).query(() => []),
      create: t.procedure
        .input(
          z.object({
            name: z.string(),
            tags: z.array(z.string()).optional(),
          }),
        )
        .mutation(() => ({ id: 1 })),
    }),
  });

  it("emits a valid OpenAPI 3.0 envelope", () => {
    const spec = buildOpenApiSpec(sampleRouter, {
      title: "Test API",
      version: "1.0.0",
    });
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("Test API");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.components.securitySchemes.cookieAuth.type).toBe("apiKey");
  });

  it("emits correct paths and methods", () => {
    const spec = buildOpenApiSpec(sampleRouter, {
      title: "Test API",
      version: "1.0.0",
    });
    expect(spec.paths["/api/trpc/health"]).toBeDefined();
    expect(spec.paths["/api/trpc/health"]!.get).toBeDefined();
    expect(spec.paths["/api/trpc/items.list"]).toBeDefined();
    expect(spec.paths["/api/trpc/items.list"]!.get).toBeDefined();
    expect(spec.paths["/api/trpc/items.create"]).toBeDefined();
    expect(spec.paths["/api/trpc/items.create"]!.post).toBeDefined();
  });

  it("attaches input schema as request body for mutations", () => {
    const spec = buildOpenApiSpec(sampleRouter, {
      title: "Test API",
      version: "1.0.0",
    });
    const op = spec.paths["/api/trpc/items.create"]!.post!;
    expect(op.requestBody).toBeDefined();
    const schema = op.requestBody!.content["application/json"]!.schema as {
      type: string;
      required?: string[];
    };
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["name"]);
  });

  it("attaches input schema as URL parameter for queries", () => {
    const spec = buildOpenApiSpec(sampleRouter, {
      title: "Test API",
      version: "1.0.0",
    });
    const op = spec.paths["/api/trpc/items.list"]!.get!;
    expect(op.parameters).toHaveLength(1);
    expect(op.parameters![0]!.name).toBe("input");
    expect(op.parameters![0]!.in).toBe("query");
  });

  it("groups procedures by top-level tag", () => {
    const spec = buildOpenApiSpec(sampleRouter, {
      title: "Test API",
      version: "1.0.0",
    });
    expect(spec.paths["/api/trpc/items.list"]!.get!.tags).toContain("items");
    expect(spec.paths["/api/trpc/health"]!.get!.tags).toContain("health");
  });

  it("emits responses including 200/400/401/500", () => {
    const spec = buildOpenApiSpec(sampleRouter, {
      title: "Test API",
      version: "1.0.0",
    });
    const op = spec.paths["/api/trpc/items.list"]!.get!;
    expect(op.responses["200"]).toBeDefined();
    expect(op.responses["400"]).toBeDefined();
    expect(op.responses["401"]).toBeDefined();
    expect(op.responses["500"]).toBeDefined();
  });
});
