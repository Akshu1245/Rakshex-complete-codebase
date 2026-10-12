/**
 * Offline YC #13 beta: compare two local OpenAPI 3.x files.
 * No network calls, provider credentials, LLMs, or repository mutations.
 */
import { readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { diffOpenApiContracts } from "@rakshex/scanner-core";
import { runOasdiff } from "./oasdiffAdapter.js";

const MAX_SPEC_BYTES = 5 * 1024 * 1024;

function readOpenApiFile(filePath: string): unknown {
  const absolutePath = resolve(filePath);
  const extension = extname(absolutePath).toLowerCase();
  if (![".json", ".yaml", ".yml"].includes(extension)) {
    throw new Error("Use local .json, .yaml or .yml OpenAPI documents.");
  }
  const stat = statSync(absolutePath);
  if (!stat.isFile()) throw new Error("Expected a local file: " + basename(absolutePath));
  if (stat.size > MAX_SPEC_BYTES) {
    throw new Error("OpenAPI document exceeds the 5 MiB limit: " + basename(absolutePath));
  }
  const source = readFileSync(absolutePath, "utf8");
  try {
    return extension === ".json" ? JSON.parse(source) : parseYaml(source, { uniqueKeys: true });
  } catch {
    // Parser diagnostics may contain snippets of an API specification or credentials.
    throw new Error("Invalid OpenAPI JSON/YAML in " + basename(absolutePath));
  }
}

function validateOpenApiDocument(input: unknown): void {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !("openapi" in input) ||
    typeof input.openapi !== "string" ||
    !/^3\.[01](?:\.|$)/.test(input.openapi) ||
    !("paths" in input) ||
    !input.paths ||
    typeof input.paths !== "object" ||
    Array.isArray(input.paths)
  ) {
    throw new Error("Expected an OpenAPI 3.0/3.1 document with a paths object.");
  }
}

export function cmdApiDiff(positional: string[], flags: Record<string, string | boolean>): number {
  if (positional.length !== 3 || positional[0] !== "diff") {
    console.error(
      "Usage: rakshex api diff <old.json|yaml> <new.json|yaml> [--engine basic|oasdiff] [--format terminal|json]",
    );
    return 2;
  }
  const format = flags.format ?? "terminal";
  if (typeof format !== "string" || !["terminal", "json"].includes(format)) {
    console.error("api diff: --format must be terminal or json");
    return 2;
  }
  const engine = flags.engine ?? "basic";
  if (engine !== "basic" && engine !== "oasdiff") {
    console.error("api diff: --engine must be basic or oasdiff");
    return 2;
  }
  if (Object.keys(flags).some((key) => key !== "format" && key !== "engine")) {
    console.error("api diff: unsupported option");
    return 2;
  }
  try {
    const before = readOpenApiFile(positional[1]!);
    const after = readOpenApiFile(positional[2]!);
    validateOpenApiDocument(before);
    validateOpenApiDocument(after);
    const result =
      engine === "oasdiff"
        ? runOasdiff(resolve(positional[1]!), resolve(positional[2]!))
        : diffOpenApiContracts(before, after);
    if (format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Detected " + result.changes.length + " supported breaking change(s).");
      for (const change of result.changes) {
        const kind = "kind" in change ? change.kind : change.id;
        const method = "method" in change ? change.method : (change.operation ?? "API");
        const detail = "message" in change ? change.message : (change.text ?? change.id);
        console.log("  [" + kind + "] " + method + " " + change.path + ": " + detail);
      }
      console.log("Coverage: " + result.scope);
    }
    // Exit 0 means no *supported* breaking changes were detected, NOT full compatibility.
    return result.breaking ? 1 : 0;
  } catch (error) {
    console.error("api diff: " + (error instanceof Error ? error.message : "comparison failed"));
    return 2;
  }
}
