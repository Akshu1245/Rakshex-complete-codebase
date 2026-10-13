/**
 * Offline, conservative TypeScript/JavaScript HTTP call-site discovery.
 *
 * This is a candidate finder, NOT proof that a customer call will break.
 * Do not turn "no matches" into a deployment approval. Dynamic calls, aliases
 * and generated clients can be missed; the report makes these limits explicit.
 */
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "vendor",
]);
const MAX_FILES = 3_000;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_DEPTH = 20;
const METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

export interface ImpactChange {
  id?: string;
  kind?: string;
  method?: string;
  operation?: string;
  path?: string;
}

export interface ApiImpactMatch {
  rule: string;
  method: string;
  path: string;
  file: string;
  line: number;
  column: number;
  call: "fetch" | "axios";
  confidence: "candidate";
}

export interface ApiImpactReport {
  status: "partial";
  filesScanned: number;
  callsInspected: number;
  dynamicCalls: number;
  parseErrors: number;
  unlocatedChanges: number;
  changesWithoutMatches: number;
  matches: ApiImpactMatch[];
  scope: string;
}

function property(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const item of object.properties) {
    if (!ts.isPropertyAssignment(item)) continue;
    const key = ts.isIdentifier(item.name) || ts.isStringLiteral(item.name) ? item.name.text : "";
    if (key === name) return item.initializer;
  }
  return undefined;
}

function staticText(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      value += "{*}" + span.literal.text;
    }
    return value;
  }
  return null;
}

function httpMethod(node: ts.Expression | undefined, fallback: string): string | null {
  if (!node) return fallback;
  const value = staticText(node);
  if (!value || !METHODS.has(value.toLowerCase())) return null;
  return value.toUpperCase();
}

function methodFromOptions(options: ts.ObjectLiteralExpression): string | null {
  // Spread/shorthand options can override a method: never assume GET.
  if (
    options.properties.some(
      (item) =>
        ts.isSpreadAssignment(item) ||
        (ts.isShorthandPropertyAssignment(item) && item.name.text === "method"),
    )
  ) {
    return null;
  }
  return httpMethod(property(options, "method"), "GET");
}

function urlPath(value: string): string | null {
  let url = value.trim();
  if (/^https?:\/\//i.test(url)) {
    url = url.replace(/^https?:\/\/[^/]+/i, "");
  } else if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith("//")) {
    return null;
  }
  if (!url.startsWith("/")) return null;
  const path = url.split(/[?#]/, 1)[0] ?? "/";
  return path.replace(/\/+$/, "") || "/";
}

function pathMatches(specPath: string, callPath: string): boolean {
  const expected = (urlPath(specPath) ?? specPath).split("/").filter(Boolean);
  const actual = callPath.split("/").filter(Boolean);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, i) => {
    const observed = actual[i];
    return segment === observed || /^\{[^/{}]+\}$/.test(segment) || observed === "{*}";
  });
}

interface Candidate {
  call: "fetch" | "axios";
  method: string | null;
  path: string | null;
}

function candidate(node: ts.CallExpression, axiosNames: Set<string>): Candidate | null {
  const callee = node.expression;
  const isFetch =
    (ts.isIdentifier(callee) && callee.text === "fetch") ||
    (ts.isPropertyAccessExpression(callee) &&
      callee.name.text === "fetch" &&
      ts.isIdentifier(callee.expression) &&
      ["globalThis", "window"].includes(callee.expression.text));
  if (isFetch) {
    const opts = node.arguments[1];
    const method = opts
      ? ts.isObjectLiteralExpression(opts)
        ? methodFromOptions(opts)
        : null
      : "GET";
    const text = staticText(node.arguments[0]);
    return { call: "fetch", method, path: text === null ? null : urlPath(text) };
  }

  let method: string | null = null;
  let url: ts.Expression | undefined;
  if (ts.isIdentifier(callee) && axiosNames.has(callee.text)) {
    const opts = node.arguments[0];
    if (opts && ts.isObjectLiteralExpression(opts)) {
      method = methodFromOptions(opts);
      url = property(opts, "url");
    } else {
      method = "GET";
      url = opts;
    }
  } else if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    axiosNames.has(callee.expression.text)
  ) {
    const operation = callee.name.text.toLowerCase();
    if (METHODS.has(operation)) {
      method = operation.toUpperCase();
      url = node.arguments[0];
    } else if (operation === "request") {
      const opts = node.arguments[0];
      if (opts && ts.isObjectLiteralExpression(opts)) {
        method = methodFromOptions(opts);
        url = property(opts, "url");
      }
    } else {
      return null;
    }
  } else {
    return null;
  }
  const text = staticText(url);
  return { call: "axios", method, path: text === null ? null : urlPath(text) };
}

function axiosImports(source: ts.SourceFile): Set<string> {
  const names = new Set<string>(["axios"]);
  for (const stmt of source.statements) {
    if (
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === "axios" &&
      stmt.importClause?.name
    ) {
      names.add(stmt.importClause.name.text);
    }
  }
  return names;
}

export function analyzeApiImpact(rootInput: string, changes: ImpactChange[]): ApiImpactReport {
  const root = resolve(rootInput);
  if (!lstatSync(root).isDirectory()) {
    throw new Error("Impact target must be a real directory (not a file or symlink).");
  }
  const actionable = changes.flatMap((change) => {
    const method = (change.method ?? change.operation ?? "").toUpperCase();
    const path = change.path ? urlPath(change.path) : null;
    if (!method || !METHODS.has(method.toLowerCase()) || !path) return [];
    return [{ change, method, path }];
  });
  const queue = [{ dir: root, depth: 0 }];
  const matches: ApiImpactMatch[] = [];
  let filesScanned = 0;
  let bytesScanned = 0;
  let callsInspected = 0;
  let dynamicCalls = 0;
  let parseErrors = 0;
  const matchedChanges = new Set<ImpactChange>();

  while (queue.length > 0) {
    const { dir, depth } = queue.pop()!;
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const file = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (depth >= MAX_DEPTH) throw new Error("Impact scan exceeded directory depth limit.");
        queue.push({ dir: file, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile() || entry.name.endsWith(".d.ts")) continue;
      if (!SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      const size = lstatSync(file).size;
      if (size > MAX_FILE_BYTES) throw new Error("Impact scan exceeded per-file size limit.");
      bytesScanned += size;
      filesScanned++;
      if (filesScanned > MAX_FILES || bytesScanned > MAX_TOTAL_BYTES) {
        throw new Error("Impact scan exceeded source limits; narrow the source directory.");
      }
      const content = readFileSync(file, "utf8");
      const scriptKind = [".tsx", ".jsx"].includes(extname(file).toLowerCase())
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS;
      const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind);
      const parseDiagnostics = (
        sf as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
      ).parseDiagnostics;
      if (parseDiagnostics?.length) parseErrors++;
      const axiosNames = axiosImports(sf);
      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const call = candidate(node, axiosNames);
          if (call) {
            callsInspected++;
            if (!call.method || !call.path) {
              dynamicCalls++;
            } else {
              for (const { change, method, path } of actionable) {
                if (method !== call.method || !pathMatches(path, call.path)) continue;
                const loc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                matchedChanges.add(change);
                matches.push({
                  rule: change.kind ?? change.id ?? "contract-change",
                  method,
                  path,
                  file: relative(root, file).replace(/\\/g, "/"),
                  line: loc.line + 1,
                  column: loc.character + 1,
                  call: call.call,
                  confidence: "candidate",
                });
              }
            }
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(sf);
    }
  }

  matches.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.column - b.column ||
      a.rule.localeCompare(b.rule),
  );
  return {
    status: "partial",
    filesScanned,
    callsInspected,
    dynamicCalls,
    parseErrors,
    unlocatedChanges: changes.length - actionable.length,
    changesWithoutMatches: changes.length - matchedChanges.size,
    matches,
    scope:
      "Static fetch/axios literal and template URL candidates only, method+path matching. " +
      "No imported client instances, interprocedural flow, provider-host verification, generated SDK " +
      "mapping, dynamic requests, runtime proof, or automated edits. Zero matches is NOT proof of safety.",
  };
}
