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
import { StripeSdkResolver } from "./stripeSdkImpact.js";
import { emptyPayload, fromBodyExpression, fromObjectLiteral, fromQuery, mergePayload } from "./payloadEvidence.js";

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
  call: "fetch" | "axios" | "stripe-sdk";
  confidence: "candidate";
}

/**
 * Request-payload evidence for one call site. `keys` are slash-joined nested
 * property paths (oasdiff style, e.g. "risk_assessment/card_testing_risk/level").
 * status "resolved" = every key was statically known; "partial" = some keys known,
 * something (spread, computed key, non-literal body) could not be resolved;
 * "unknown" = nothing could be resolved. Never upgrade unknown to "absent".
 */
export interface PayloadEvidence {
  status: "resolved" | "partial" | "unknown";
  keys: string[];
  values: Record<string, string>;
  unresolved: string[];
  via: string[];
}

export interface ApiCallSite {
  file: string;
  line: number;
  column: number;
  call: "fetch" | "axios" | "stripe-sdk";
  method: string | null;
  path: string | null;
  host: string | null;
  sdkMethod?: string;
  payload: PayloadEvidence;
  reason?: string;
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
  /** Every inspected outbound call (matched or not), with payload evidence. */
  sites: ApiCallSite[];
  scope: string;
}

export interface ApiImpactOptions {
  /** Only absolute URLs whose host is in this list are attributed to the spec (e.g. api.stripe.com). Relative URLs are kept. */
  hosts?: string[];
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
  url: string | null;
  body?: ts.Expression;
  params?: ts.Expression;
}

function urlHost(value: string | null): string | null {
  if (!value) return null;
  const m = /^https?:\/\/([^/?#]+)/i.exec(value.trim());
  return m ? m[1]!.toLowerCase() : null;
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
    const body = opts && ts.isObjectLiteralExpression(opts) ? property(opts, "body") : undefined;
    return { call: "fetch", method, path: text === null ? null : urlPath(text), url: text, body };
  }

  let method: string | null = null;
  let url: ts.Expression | undefined;
  let body: ts.Expression | undefined;
  let params: ts.Expression | undefined;
  if (ts.isIdentifier(callee) && axiosNames.has(callee.text)) {
    const opts = node.arguments[0];
    if (opts && ts.isObjectLiteralExpression(opts)) {
      method = methodFromOptions(opts);
      url = property(opts, "url");
      body = property(opts, "data");
      params = property(opts, "params");
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
      const hasBody = ["post", "put", "patch"].includes(operation);
      body = hasBody ? node.arguments[1] : undefined;
      const cfg = node.arguments[hasBody ? 2 : 1];
      if (cfg && ts.isObjectLiteralExpression(cfg)) params = property(cfg, "params");
    } else if (operation === "request") {
      const opts = node.arguments[0];
      if (opts && ts.isObjectLiteralExpression(opts)) {
        method = methodFromOptions(opts);
        url = property(opts, "url");
        body = property(opts, "data");
        params = property(opts, "params");
      }
    } else {
      return null;
    }
  } else {
    return null;
  }
  const text = staticText(url);
  return { call: "axios", method, path: text === null ? null : urlPath(text), url: text, body, params };
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

export function analyzeApiImpact(
  rootInput: string,
  changes: ImpactChange[],
  options: ApiImpactOptions = {},
): ApiImpactReport {
  const hosts = options.hosts?.map((h) => h.toLowerCase());
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
  const sites: ApiCallSite[] = [];
  let filesScanned = 0;
  let bytesScanned = 0;
  let callsInspected = 0;
  let dynamicCalls = 0;
  let parseErrors = 0;
  const matchedChanges = new Set<ImpactChange>();
  const files: string[] = [];

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
      files.push(file);
    }
  }

  const compilerOptions: ts.CompilerOptions = {
    allowJs: true, noEmit: true, noLib: true, types: [], skipLibCheck: true,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(compilerOptions, true);
  // Only resolve relative imports inside the scanned tree; never load node_modules typings.
  host.resolveModuleNameLiterals = (literals, containingFile) =>
    literals.map((lit) => {
      if (!lit.text.startsWith(".")) return { resolvedModule: undefined };
      const r = ts.resolveModuleName(lit.text, containingFile, compilerOptions, host).resolvedModule;
      return { resolvedModule: r && resolve(r.resolvedFileName).startsWith(root) ? r : undefined };
    });
  const program = ts.createProgram({ rootNames: files, options: compilerOptions, host });
  const sourceFiles = files.map((f) => program.getSourceFile(f)).filter((x): x is ts.SourceFile => !!x);
  const sdk = new StripeSdkResolver(program.getTypeChecker(), sourceFiles);
  for (const sf of sourceFiles) {
    const file = sf.fileName;
    const siteOf = (n: ts.Node) => {
      const nsf = n.getSourceFile();
      const p = nsf.getLineAndCharacterOfPosition(n.getStart(nsf));
      return { file: relative(root, nsf.fileName).replace(/\\/g, "/"), line: p.line + 1, column: p.character + 1 };
    };
      const parseDiagnostics = (
        sf as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }
      ).parseDiagnostics;
      if (parseDiagnostics?.length) parseErrors++;
      const axiosNames = axiosImports(sf);
      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const sdkSites = sdk.sitesFor(node, siteOf);
          if (sdkSites) {
            callsInspected++;
            for (const site of sdkSites) {
              sites.push(site);
              if (!site.method || !site.path) { dynamicCalls++; continue; }
              for (const { change, method, path } of actionable) {
                if (method !== site.method || !pathMatches(path, site.path)) continue;
                matchedChanges.add(change);
                matches.push({ rule: change.kind ?? change.id ?? "contract-change", method, path, file: site.file, line: site.line, column: site.column, call: "stripe-sdk", confidence: "candidate" });
              }
            }
          }
          const call = sdkSites ? null : candidate(node, axiosNames);
          if (call) {
            callsInspected++;
            const loc0 = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            const host = urlHost(call.url);
            let payload = call.body ? fromBodyExpression(call.body, sdk.resolver) : emptyPayload();
            if (call.url) payload = mergePayload(payload, fromQuery(call.url));
            if (call.params) {
              const pe = ts.isObjectLiteralExpression(call.params) ? fromObjectLiteral(call.params) : fromBodyExpression(call.params, sdk.resolver);
              payload = mergePayload(payload, pe);
            }
            const foreignHost = !!(hosts && host && !hosts.includes(host));
            sites.push({
              file: relative(root, file).replace(/\\/g, "/"),
              line: loc0.line + 1,
              column: loc0.character + 1,
              call: call.call,
              method: call.method,
              path: call.path,
              host,
              payload,
              ...(foreignHost ? { reason: "host not in spec servers; not attributed" } : {}),
            });
            if (!call.method || !call.path) {
              dynamicCalls++;
            } else if (foreignHost) {
              // Same path on another API host is not this provider's endpoint.
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
    sites,
    scope:
      "Static fetch/axios literal and template URL candidates only, method+path matching. " +
      "No imported client instances, interprocedural flow, provider-host verification, generated SDK " +
      "mapping, dynamic requests, runtime proof, or automated edits. Zero matches is NOT proof of safety.",
  };
}
