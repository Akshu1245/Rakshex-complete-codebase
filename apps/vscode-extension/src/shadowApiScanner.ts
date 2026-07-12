/**
 * Shadow API workspace scanner.
 *
 * Patent surface NHCE/DEV/2026/003 — "A Method for Shadow API Endpoint
 * Discovery Through IDE Framework-Specific Static Route Extraction and
 * Local Development Traffic Correlation".
 *
 * This module is the static-route-extraction half of that patent: given the
 * raw text of a source file, it returns the list of HTTP route declarations
 * detected, regardless of language. The list is then compared against the
 * collection-tracked endpoints to surface "shadow" routes — code paths the
 * scanner doesn't know about.
 *
 * Pure / dependency-free so it runs identically in:
 *   - the VS Code extension (via vscode.workspace.findFiles + readFile)
 *   - the server (offline scans triggered from the dashboard)
 *   - tests (vitest)
 */

export type RouteFramework =
  "express" | "fastapi" | "flask" | "django-rest" | "spring-boot" | "laravel";

export interface DetectedRoute {
  /** HTTP method (uppercased; "*" for "any-method" framework idioms). */
  method: string;
  /** URL path as written in source. */
  path: string;
  /** 1-indexed line number where the route was matched. */
  line: number;
  /** Which framework's pattern fired. */
  framework: RouteFramework;
  /** Snippet of the matched source — useful for diagnostics. */
  snippet: string;
}

interface FrameworkRule {
  framework: RouteFramework;
  /**
   * Languages where this rule is meaningful (used to short-circuit the
   * regex pass on irrelevant files). File suffix without the dot.
   */
  extensions: string[];
  pattern: RegExp;
  /**
   * Extract `[method, path]` from a regex match. `method` may be a literal
   * verb or "*" to indicate "any method".
   */
  extract(match: RegExpExecArray): { method: string; path: string } | null;
}

/**
 * Strip the surrounding quotes (any of `'`, `"`, `` ` ``) from a captured
 * string. Returns `null` if the captured value is not a simple quoted
 * string literal — we deliberately don't try to evaluate template literals
 * or string concatenations.
 */
function unquote(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (first !== last || (first !== "'" && first !== '"' && first !== "`")) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  // Skip template-literal expressions — we can't statically resolve them.
  if (first === "`" && inner.includes("${")) return null;
  return inner;
}

const RULES: FrameworkRule[] = [
  // Express / Koa / Fastify all share the same `app.METHOD(path, handler)`
  // sugar. We match the common verbs plus `app.use(path,...)`.
  {
    framework: "express",
    extensions: ["js", "jsx", "ts", "tsx", "mjs", "cjs"],
    pattern:
      /\b(?:app|router|express\(\)|server)\s*\.\s*(get|post|put|delete|patch|options|head|all|use)\s*\(\s*((?:'[^']*'|"[^"]*"|`[^`]*`))/g,
    extract(m) {
      const verb = m[1]?.toLowerCase();
      const path = unquote(m[2]);
      if (!path || !verb) return null;
      return {
        method: verb === "all" || verb === "use" ? "*" : verb.toUpperCase(),
        path,
      };
    },
  },
  // FastAPI (and Starlette): `@app.get("/path")`, `@router.post("/path")`.
  {
    framework: "fastapi",
    extensions: ["py"],
    pattern:
      /@\s*(?:app|router|api|api_router)\s*\.\s*(get|post|put|delete|patch|options|head|websocket|api_route)\s*\(\s*((?:'[^']*'|"[^"]*"))/g,
    extract(m) {
      const verb = m[1]?.toLowerCase();
      const path = unquote(m[2]);
      if (!path || !verb) return null;
      return {
        method: verb === "websocket" || verb === "api_route" ? "*" : verb.toUpperCase(),
        path,
      };
    },
  },
  // Flask: `@app.route("/path", methods=["POST"])` or just
  // `@app.route("/path")` (defaults to GET).
  {
    framework: "flask",
    extensions: ["py"],
    pattern:
      /@\s*(?:app|bp|blueprint|api)\s*\.\s*route\s*\(\s*((?:'[^']*'|"[^"]*"))(?:\s*,\s*methods\s*=\s*\[([^\]]*)\])?/g,
    extract(m) {
      const path = unquote(m[1]);
      if (!path) return null;
      const methodsRaw = (m[2] ?? "").trim();
      // Flask defaults to GET when methods= is not supplied.
      if (!methodsRaw) return { method: "GET", path };
      const verbs = methodsRaw
        .split(/[,\s]+/)
        .map((s) => unquote(s) ?? s.replace(/['"]/g, "").trim())
        .filter(Boolean)
        .map((v) => v.toUpperCase());
      // Surface the first method; the caller can re-emit per-method if needed.
      const method = verbs[0] ?? "GET";
      return { method, path };
    },
  },
  // Django: `path("foo/", view)` or `re_path(r"^foo/$", view)` — method is
  // unknown statically (it's defined on the view class), so emit "*". We
  // accept the optional `r`/`b` raw-string prefix Python allows.
  {
    framework: "django-rest",
    extensions: ["py"],
    pattern: /\b(?:re_)?path\s*\(\s*[rRbB]?((?:'[^']*'|"[^"]*"))\s*,/g,
    extract(m) {
      const path = unquote(m[1]);
      if (!path) return null;
      return { method: "*", path };
    },
  },
  // Spring Boot: `@GetMapping("/path")`, `@PostMapping`, `@RequestMapping`.
  {
    framework: "spring-boot",
    extensions: ["java", "kt"],
    pattern:
      /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?((?:'[^']*'|"[^"]*"))/g,
    extract(m) {
      const verb = m[1];
      const path = unquote(m[2]);
      if (!path || !verb) return null;
      return {
        method: verb === "Request" ? "*" : verb.toUpperCase(),
        path,
      };
    },
  },
  // Laravel: `Route::get('/path', ...)`.
  {
    framework: "laravel",
    extensions: ["php"],
    pattern:
      /\bRoute\s*::\s*(get|post|put|delete|patch|options|any|match)\s*\(\s*((?:'[^']*'|"[^"]*"))/g,
    extract(m) {
      const verb = m[1]?.toLowerCase();
      const path = unquote(m[2]);
      if (!path || !verb) return null;
      return {
        method: verb === "any" || verb === "match" ? "*" : verb.toUpperCase(),
        path,
      };
    },
  },
];

function lineNumberFor(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function extensionOf(filePath: string): string {
  const i = filePath.lastIndexOf(".");
  if (i < 0) return "";
  return filePath.slice(i + 1).toLowerCase();
}

/**
 * Scan one file's contents for HTTP route declarations.
 */
export function detectRoutesInFile(filePath: string, contents: string): DetectedRoute[] {
  const ext = extensionOf(filePath);
  const out: DetectedRoute[] = [];
  for (const rule of RULES) {
    if (!rule.extensions.includes(ext)) continue;
    // Reset lastIndex; rules use /g regexes.
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(contents)) !== null) {
      const r = rule.extract(m);
      if (!r) continue;
      out.push({
        method: r.method,
        path: r.path,
        line: lineNumberFor(contents, m.index),
        framework: rule.framework,
        snippet: contents.slice(m.index, m.index + Math.min(120, m[0].length)),
      });
    }
  }
  return out;
}

/**
 * Compare a list of statically-detected routes against the set of
 * known-tracked endpoints (e.g. ones already in the user's Postman
 * collection or OpenAPI spec) and return the shadow set: declared in
 * code but not present in the tracked inventory.
 *
 * Comparison normalises both sides (lower-case, strip trailing slash,
 * collapse path-parameter syntax to `:param` so `/users/:id`,
 * `/users/{id}`, and `/users/<id>` all compare equal).
 */
export function findShadowRoutes(
  detected: DetectedRoute[],
  trackedKeys: string[],
): DetectedRoute[] {
  const norm = (m: string, p: string) => `${m}:${normalisePath(p)}`;
  const tracked = new Set(
    trackedKeys.map((k) => {
      const i = k.indexOf(":");
      if (i < 0) return norm("*", k);
      return norm(k.slice(0, i), k.slice(i + 1));
    }),
  );
  return detected.filter((d) => {
    const exact = norm(d.method, d.path);
    const wildcard = norm("*", d.path);
    return !tracked.has(exact) && !tracked.has(wildcard);
  });
}

export function normalisePath(p: string): string {
  let out = p.trim().toLowerCase();
  // Strip query string.
  const q = out.indexOf("?");
  if (q >= 0) out = out.slice(0, q);
  // Collapse path-parameter syntaxes to a uniform `:param` form.
  out = out
    .replace(/\{([^}]+)\}/g, ":$1") // /users/{id} → /users/:id
    .replace(/<(?:[^:>]+:)?([^>]+)>/g, ":$1"); // /users/<int:id> → /users/:id
  // Strip trailing slash unless that's the whole path.
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/**
 * Aggregate scan helper: takes [{path, contents}, ...] for a workspace,
 * returns the merged list of detected routes plus the shadow subset.
 */
export function scanWorkspace(
  files: Array<{ path: string; contents: string }>,
  trackedKeys: string[] = [],
): { detected: DetectedRoute[]; shadow: DetectedRoute[] } {
  const detected: DetectedRoute[] = [];
  for (const f of files) {
    detected.push(...detectRoutesInFile(f.path, f.contents));
  }
  const shadow = findShadowRoutes(detected, trackedKeys);
  return { detected, shadow };
}
