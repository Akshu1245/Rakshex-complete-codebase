/**
 * Static request-payload key extraction for impact analysis.
 * Conservative: anything not statically known is recorded in `unresolved`,
 * never silently treated as "key absent".
 */
import ts from "typescript";
import type { PayloadEvidence } from "./apiImpact.js";

/** Resolves an expression (e.g. an identifier used in a spread) to an object literal, or null. */
export type ExpressionResolver = (expr: ts.Expression) => { node: ts.Expression; via: string } | null;

const MAX_DEPTH = 8;

export function emptyPayload(status: PayloadEvidence["status"] = "resolved"): PayloadEvidence {
  return { status, keys: [], values: {}, unresolved: [], via: [] };
}

function finalize(p: PayloadEvidence): PayloadEvidence {
  p.keys = [...new Set(p.keys)].sort();
  p.via = [...new Set(p.via)];
  if (p.unresolved.length > 0) p.status = p.keys.length > 0 ? "partial" : "unknown";
  return p;
}

/** Form-style keys ("a[b][]") become oasdiff-style paths ("a/b"). */
function normKey(raw: string): string {
  if (!raw.includes("[")) return raw;
  return raw.replace(/\]/g, "").split("[").filter((s) => s !== "" && !/^\d+$/.test(s)).join("/");
}

function propName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return normKey(name.text);
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return normKey(name.expression.text);
  return null;
}

function unwrap(expr: ts.Expression): ts.Expression {
  let e = expr;
  while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e) || ts.isNonNullExpression(e) || ts.isTypeAssertionExpression(e)) e = e.expression;
  return e;
}

function literalValue(e: ts.Expression): string | null {
  const u = unwrap(e);
  if (ts.isStringLiteralLike(u) || ts.isNumericLiteral(u)) return u.text;
  if (u.kind === ts.SyntaxKind.TrueKeyword) return "true";
  if (u.kind === ts.SyntaxKind.FalseKeyword) return "false";
  if (ts.isArrayLiteralExpression(u)) {
    const parts = u.elements.map((x) => literalValue(x));
    return parts.every((x) => x !== null) ? "[" + parts.join(",") + "]" : null;
  }
  return null;
}

function walkObject(obj: ts.ObjectLiteralExpression, prefix: string, out: PayloadEvidence, resolve: ExpressionResolver | undefined, depth: number): void {
  if (depth > MAX_DEPTH) { out.unresolved.push((prefix || "<root>") + ": nesting too deep"); return; }
  for (const item of obj.properties) {
    if (ts.isSpreadAssignment(item)) {
      const r = resolve?.(item.expression);
      const target = r ? unwrap(r.node) : null;
      if (r && target && ts.isObjectLiteralExpression(target)) {
        out.via.push(r.via);
        walkObject(target, prefix, out, resolve, depth + 1);
      } else {
        out.unresolved.push((prefix ? prefix + "/" : "") + "...(" + item.expression.getText().slice(0, 60) + ")");
      }
      continue;
    }
    if (ts.isShorthandPropertyAssignment(item)) {
      const key = (prefix ? prefix + "/" : "") + item.name.text;
      out.keys.push(key);
      const r = resolve?.(item.name);
      const t = r ? unwrap(r.node) : null;
      if (r && t && ts.isObjectLiteralExpression(t)) { out.via.push(r.via); walkObject(t, key, out, resolve, depth + 1); }
      else if (r && t) { const v = literalValue(t); if (v !== null) out.values[key] = v; }
      continue;
    }
    if (ts.isPropertyAssignment(item)) {
      const name = propName(item.name);
      if (name === null) { out.unresolved.push((prefix ? prefix + "/" : "") + "[computed key]"); continue; }
      const key = (prefix ? prefix + "/" : "") + name;
      out.keys.push(key);
      let init = unwrap(item.initializer);
      if (ts.isIdentifier(init) && resolve) {
        const r = resolve(init);
        if (r && ts.isObjectLiteralExpression(unwrap(r.node))) { out.via.push(r.via); init = unwrap(r.node); }
      }
      if (ts.isObjectLiteralExpression(init)) walkObject(init, key, out, resolve, depth + 1);
      else if (ts.isArrayLiteralExpression(init) && init.elements.some((el) => ts.isObjectLiteralExpression(unwrap(el)))) {
        // Array of objects: OpenAPI/oasdiff name element properties as <key>/items/<prop>.
        for (const el of init.elements) {
          const u = unwrap(el);
          if (ts.isObjectLiteralExpression(u)) walkObject(u, key + "/items", out, resolve, depth + 1);
          else out.unresolved.push(key + "/items: non-literal element");
        }
      } else { const v = literalValue(init); if (v !== null) out.values[key] = v; }
      continue;
    }
    // methods/accessors are not request data
  }
}

export function fromObjectLiteral(obj: ts.ObjectLiteralExpression, resolve?: ExpressionResolver): PayloadEvidence {
  const out = emptyPayload();
  walkObject(obj, "", out, resolve, 0);
  return finalize(out);
}

/** application/x-www-form-urlencoded with Stripe-style brackets: a[b][]=1 -> a/b */
export function fromFormString(text: string): PayloadEvidence {
  const out = emptyPayload();
  for (const pair of text.split("&")) {
    if (!pair) continue;
    let raw = pair.split("=", 1)[0] ?? "";
    try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
    if (raw.includes("{*}")) { out.unresolved.push("template key"); continue; }
    const segs = raw.replace(/\]/g, "").split("[").filter((s) => s !== "" && !/^\d+$/.test(s));
    if (segs.length === 0) continue;
    const key = segs.join("/");
    out.keys.push(key);
    const v = pair.includes("=") ? pair.slice(pair.indexOf("=") + 1) : "";
    if (!v.includes("{*}") && !raw.endsWith("[]")) out.values[key] = v;
  }
  return finalize(out);
}

function staticString(e: ts.Expression): string | null {
  const u = unwrap(e);
  if (ts.isStringLiteralLike(u)) return u.text;
  if (ts.isTemplateExpression(u)) {
    let v = u.head.text;
    for (const s of u.templateSpans) v += "{*}" + s.literal.text;
    return v;
  }
  return null;
}

/** Body expression of fetch()/axios: object literal, form string, JSON.stringify({...}), URLSearchParams({...}). */
export function fromBodyExpression(expr: ts.Expression | undefined, resolve?: ExpressionResolver): PayloadEvidence {
  if (!expr) return emptyPayload("resolved");
  let e = unwrap(expr);
  if (ts.isIdentifier(e) && resolve) {
    const r = resolve(e);
    if (r) { const inner = fromBodyExpression(r.node, resolve); inner.via.push(r.via); return inner; }
  }
  if (ts.isObjectLiteralExpression(e)) return fromObjectLiteral(e, resolve);
  const str = staticString(e);
  if (str !== null) return fromFormString(str);
  if ((ts.isCallExpression(e) || ts.isNewExpression(e)) && e.arguments && e.arguments.length === 1) {
    const callee = e.expression.getText();
    if (["JSON.stringify", "URLSearchParams", "new URLSearchParams", "qs.stringify"].includes(callee) || callee === "URLSearchParams") {
      const arg = unwrap(e.arguments[0]!);
      if (ts.isObjectLiteralExpression(arg)) return fromObjectLiteral(arg, resolve);
      if (ts.isIdentifier(arg) && resolve) { const r = resolve(arg); if (r && ts.isObjectLiteralExpression(unwrap(r.node))) { const p = fromObjectLiteral(unwrap(r.node) as ts.ObjectLiteralExpression, resolve); p.via.push(r.via); return p; } }
    }
  }
  const out = emptyPayload();
  out.unresolved.push("body: " + expr.getText().slice(0, 60));
  return finalize(out);
}

/** Query-string keys of a static URL. */
export function fromQuery(url: string): PayloadEvidence {
  const q = url.split("#", 1)[0]!.split("?")[1];
  return q ? fromFormString(q) : emptyPayload();
}

export function mergePayload(a: PayloadEvidence, b: PayloadEvidence): PayloadEvidence {
  return finalize({ status: "resolved", keys: [...a.keys, ...b.keys], values: { ...a.values, ...b.values }, unresolved: [...a.unresolved, ...b.unresolved], via: [...a.via, ...b.via] });
}
