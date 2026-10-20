/**
 * Offline YC #13 beta: compare two local OpenAPI 3.x files.
 * No network calls, provider credentials, LLMs, or repository mutations.
 */
import { readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { diffOpenApiContracts } from "@rakshex/scanner-core";
import { runOasdiff } from "./oasdiffAdapter.js";
import { analyzeApiImpact } from "./apiImpact.js";
import { normalizeConsumerImpact } from "./consumerImpact.js";

/** Default per-document cap. Real provider specs (Stripe ~8 MiB) need an explicit, bounded opt-in. */
export const DEFAULT_SPEC_MIB = 5;
/** Hard ceiling: never accept more than this, whatever the flag says. */
export const HARD_MAX_SPEC_MIB = 32;

export function parseSpecLimit(flag: unknown): number {
  if (flag === undefined) return DEFAULT_SPEC_MIB;
  const n = typeof flag === "string" && /^\d+$/.test(flag) ? Number(flag) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > HARD_MAX_SPEC_MIB) {
    throw new Error("--max-spec-mib must be an integer from 1 to " + HARD_MAX_SPEC_MIB);
  }
  return n;
}

function specHosts(doc: unknown): string[] {
  const servers = (doc as { servers?: { url?: unknown }[] }).servers;
  if (!Array.isArray(servers)) return [];
  return servers.flatMap((s) => {
    const m = typeof s?.url === "string" ? /^https?:\/\/([^/]+)/i.exec(s.url) : null;
    return m ? [m[1]!.toLowerCase()] : [];
  });
}

function readOpenApiFile(filePath: string, maxMib = DEFAULT_SPEC_MIB): unknown {
  const absolutePath = resolve(filePath);
  const extension = extname(absolutePath).toLowerCase();
  if (![".json", ".yaml", ".yml"].includes(extension)) {
    throw new Error("Use local .json, .yaml or .yml OpenAPI documents.");
  }
  const stat = statSync(absolutePath);
  if (!stat.isFile()) throw new Error("Expected a local file: " + basename(absolutePath));
  if (stat.size > maxMib * 1024 * 1024) {
    throw new Error(
      "OpenAPI document exceeds the " + maxMib + " MiB limit: " + basename(absolutePath) +
        (maxMib < HARD_MAX_SPEC_MIB ? " (raise with --max-spec-mib, max " + HARD_MAX_SPEC_MIB + ")" : ""),
    );
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
      "Usage: rakshex api diff <old.json|yaml> <new.json|yaml> [--engine basic|oasdiff] [--format terminal|json] [--impact-dir <source-dir>]",
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
  const impactDir = flags["impact-dir"];
  if (impactDir !== undefined && (typeof impactDir !== "string" || !impactDir.trim())) {
    console.error("api diff: --impact-dir must be a local source directory");
    return 2;
  }
  if (Object.keys(flags).some((key) => !["format", "engine", "impact-dir", "max-spec-mib"].includes(key))) {
    console.error("api diff: unsupported option");
    return 2;
  }
  try {
    const maxMib = parseSpecLimit(flags["max-spec-mib"]);
    const before = readOpenApiFile(positional[1]!, maxMib);
    const after = readOpenApiFile(positional[2]!, maxMib);
    validateOpenApiDocument(before);
    validateOpenApiDocument(after);
    const result =
      engine === "oasdiff"
        ? runOasdiff(resolve(positional[1]!), resolve(positional[2]!), { maxOutputMib: maxMib * 8 })
        : diffOpenApiContracts(before, after);
    const hosts = [...new Set([...specHosts(before), ...specHosts(after)])];
    const impact = impactDir
      ? analyzeApiImpact(impactDir, result.changes, hosts.length ? { hosts } : {})
      : undefined;
    const consumerImpact = impact
      ? normalizeConsumerImpact(result.changes as Parameters<typeof normalizeConsumerImpact>[0], impact.sites)
      : undefined;
    if (format === "json") {
      console.log(JSON.stringify(impact ? { ...result, impact, consumerImpact } : result, null, 2));
    } else {
      console.log("Detected " + result.changes.length + " supported breaking change(s).");
      for (const change of result.changes) {
        const kind = "kind" in change ? change.kind : change.id;
        const method = "method" in change ? change.method : (change.operation ?? "API");
        const detail = "message" in change ? change.message : (change.text ?? change.id);
        console.log("  [" + kind + "] " + method + " " + change.path + ": " + detail);
      }
      console.log("Coverage: " + result.scope);
      if (impact) {
        console.log(
          "Impact candidates: " +
            impact.matches.length +
            " in " +
            impact.filesScanned +
            " files; " +
            impact.dynamicCalls +
            " dynamic calls and " +
            impact.changesWithoutMatches +
            " changes without mapped source calls.",
        );
        for (const match of impact.matches) {
          console.log(
            "  [candidate] " +
              match.file +
              ":" +
              match.line +
              ":" +
              match.column +
              " " +
              match.method +
              " " +
              match.path +
              " (" +
              match.rule +
              ")",
          );
        }
        console.log("Impact coverage: " + impact.scope);
        if (consumerImpact) {
          console.log(
            "Consumer impact: " + consumerImpact.impacts.length + " ranked item(s) from " +
              consumerImpact.totalChanges + " changes (" + consumerImpact.suppressedNotCalled +
              " on endpoints this code does not call).",
          );
          for (const item of consumerImpact.impacts.slice(0, 50)) {
            console.log(
              "  [" + item.verdict + "] " + item.site.file + ":" + item.site.line + " " +
                item.change.method + " " + item.change.path + " " + (item.change.property ?? "") +
                " — " + item.evidence.reason + (item.semanticWarning ? " | WARNING: " + item.semanticWarning.note : ""),
            );
          }
        }
      }
    }
    // Exit 0 means no *supported* breaking changes were detected, NOT full compatibility.
    return result.breaking ? 1 : 0;
  } catch (error) {
    console.error("api diff: " + (error instanceof Error ? error.message : "comparison failed"));
    return 2;
  }
}
