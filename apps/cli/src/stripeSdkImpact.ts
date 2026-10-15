/**
 * Typed-AST mapping of stripe-node calls to HTTP endpoints (TypeScript compiler API).
 *
 * Resolves: clients built with `new Stripe(...)` (default import or require of "stripe"),
 * clients reached through exported consts, getter functions, typed parameters/properties
 * (`s: Stripe`), wrapper functions whose params object is a parameter (traced to in-repo
 * callers), and statically resolvable const spreads. Anything else is reported UNKNOWN.
 * Never resolves "stripe" from node_modules; never executes code.
 */
import ts from "typescript";
import sdkMap from "./data/stripe-node-endpoints.json" with { type: "json" };
import type { ApiCallSite, PayloadEvidence } from "./apiImpact.js";
import { emptyPayload, fromObjectLiteral, type ExpressionResolver } from "./payloadEvidence.js";

const METHODS = (sdkMap as unknown as { methods: Record<string, [string, string]> }).methods;
export const STRIPE_SDK_MAP_VERSION = (sdkMap as { version: string }).version;
const MAX_HOPS = 6;

function unwrap(e: ts.Expression): ts.Expression {
  let x = e;
  while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x) || ts.isSatisfiesExpression(x) || ts.isTypeAssertionExpression(x)) x = x.expression;
  return x;
}

function loc(node: ts.Node): string {
  const sf = node.getSourceFile();
  const p = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return sf.fileName.split("/").slice(-2).join("/") + ":" + (p.line + 1);
}

export class StripeSdkResolver {
  private callIndex: Map<ts.Symbol, ts.CallExpression[]> | null = null;
  constructor(private readonly checker: ts.TypeChecker, private readonly files: readonly ts.SourceFile[]) {}

  private symbolOf(node: ts.Node): ts.Symbol | undefined {
    let s = this.checker.getSymbolAtLocation(node);
    if (s && s.flags & ts.SymbolFlags.Alias) {
      const decl = s.declarations?.[0];
      if (decl && this.isStripeImportDecl(decl)) return s; // keep: marker of the Stripe class
      try { s = this.checker.getAliasedSymbol(s); } catch { /* unresolved */ }
    }
    return s;
  }

  private isStripeImportDecl(decl: ts.Declaration): boolean {
    let n: ts.Node | undefined = decl;
    while (n && !ts.isImportDeclaration(n)) n = n.parent;
    if (n && ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === "stripe") {
      return ts.isImportClause(decl) || (ts.isImportSpecifier(decl) && (decl.propertyName ?? decl.name).text === "Stripe") || ts.isNamespaceImport(decl);
    }
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      const i = unwrap(decl.initializer);
      return ts.isCallExpression(i) && ts.isIdentifier(i.expression) && i.expression.text === "require" && i.arguments.length === 1 && ts.isStringLiteral(i.arguments[0]!) && i.arguments[0].text === "stripe";
    }
    return false;
  }

  /** Is this expression the Stripe *class* (constructor)? */
  private isStripeClass(e: ts.Expression): boolean {
    const x = unwrap(e);
    if (ts.isIdentifier(x)) {
      const s = this.symbolOf(x);
      return !!s?.declarations?.some((d) => this.isStripeImportDecl(d));
    }
    if (ts.isPropertyAccessExpression(x) && x.name.text === "Stripe") return this.isStripeClass(x.expression);
    return false;
  }

  private isStripeTypeNode(t: ts.TypeNode | undefined): boolean {
    if (!t || !ts.isTypeReferenceNode(t)) return false;
    const name = ts.isIdentifier(t.typeName) ? t.typeName : null;
    if (!name) return false;
    const s = this.symbolOf(name);
    return !!s?.declarations?.some((d) => this.isStripeImportDecl(d));
  }

  /** Is this expression a Stripe client *instance*? Returns an evidence trail or null. */
  clientEvidence(e: ts.Expression, hops = 0): string | null {
    if (hops > MAX_HOPS) return null;
    const x = unwrap(e);
    if (ts.isNewExpression(x)) return this.isStripeClass(x.expression) ? "new Stripe() at " + loc(x) : null;
    if (ts.isCallExpression(x)) {
      if (this.isStripeClass(x.expression)) return "Stripe() factory at " + loc(x);
      const fn = this.functionOf(x.expression);
      if (!fn) return null;
      for (const r of this.returnExpressions(fn)) {
        const ev = this.clientEvidence(r, hops + 1);
        if (ev) return "getter " + (fn.name?.getText() ?? "fn") + "() -> " + ev;
      }
      return null;
    }
    if (ts.isIdentifier(x) || ts.isPropertyAccessExpression(x)) {
      const s = this.symbolOf(ts.isPropertyAccessExpression(x) ? x.name : x) ?? (ts.isPropertyAccessExpression(x) ? this.checker.getSymbolAtLocation(x) : undefined);
      for (const d of s?.declarations ?? []) {
        if ((ts.isParameter(d) || ts.isPropertyDeclaration(d) || ts.isPropertySignature(d) || ts.isVariableDeclaration(d)) && this.isStripeTypeNode(d.type)) return "typed " + d.name.getText() + ": Stripe at " + loc(d);
        if (ts.isVariableDeclaration(d) && d.initializer && this.isConst(d)) {
          const ev = this.clientEvidence(d.initializer, hops + 1);
          if (ev) return d.name.getText() + " = " + ev;
        }
      }
    }
    return null;
  }

  private isConst(d: ts.VariableDeclaration): boolean {
    return ts.isVariableDeclarationList(d.parent) && (d.parent.flags & ts.NodeFlags.Const) !== 0;
  }

  private functionOf(callee: ts.Expression): ts.FunctionLikeDeclaration | null {
    const s = this.symbolOf(ts.isPropertyAccessExpression(callee) ? callee.name : callee);
    for (const d of s?.declarations ?? []) {
      if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d)) return d;
      if (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return d.initializer;
    }
    return null;
  }

  private returnExpressions(fn: ts.FunctionLikeDeclaration): ts.Expression[] {
    if (!fn.body) return [];
    if (!ts.isBlock(fn.body)) return [fn.body];
    const out: ts.Expression[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isFunctionLike(n) && n !== fn) return;
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
      ts.forEachChild(n, visit);
    };
    visit(fn.body);
    return out;
  }

  /** const-only resolution for spreads / identifiers. */
  readonly resolver: ExpressionResolver = (expr) => {
    const x = unwrap(expr);
    if (!ts.isIdentifier(x)) return null;
    const s = this.symbolOf(x) ?? this.checker.getShorthandAssignmentValueSymbol(x.parent);
    for (const d of s?.declarations ?? []) {
      if (ts.isVariableDeclaration(d) && d.initializer && this.isConst(d)) {
        if (s && this.isMutated(s, d)) return null; // const binding, but the object is mutated later: unresolved
        return { node: d.initializer, via: "const " + d.name.getText() + " at " + loc(d) };
      }
    }
    return null;
  };

  /** True when the object bound to `sym` is written to (x.k = …, x[k] = …, delete x.k, Object.assign(x, …)). */
  private isMutated(sym: ts.Symbol, decl: ts.VariableDeclaration): boolean {
    let mutated = false;
    const visit = (n: ts.Node): void => {
      if (mutated) return;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        const l = n.left;
        if ((ts.isPropertyAccessExpression(l) || ts.isElementAccessExpression(l)) && ts.isIdentifier(l.expression) && this.checker.getSymbolAtLocation(l.expression) === sym) mutated = true;
      }
      if (ts.isDeleteExpression(n)) {
        const e = n.expression;
        if ((ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) && ts.isIdentifier(e.expression) && this.checker.getSymbolAtLocation(e.expression) === sym) mutated = true;
      }
      if (ts.isCallExpression(n) && n.expression.getText() === "Object.assign" && n.arguments[0] && ts.isIdentifier(n.arguments[0]) && this.checker.getSymbolAtLocation(n.arguments[0]) === sym) mutated = true;
      ts.forEachChild(n, visit);
    };
    visit(decl.getSourceFile());
    return mutated;
  }

  private calls(): Map<ts.Symbol, ts.CallExpression[]> {
    if (this.callIndex) return this.callIndex;
    const idx = new Map<ts.Symbol, ts.CallExpression[]>();
    for (const sf of this.files) {
      const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
          const target = ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression;
          const s = this.symbolOf(target);
          if (s) idx.set(s, [...(idx.get(s) ?? []), n]);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    return (this.callIndex = idx);
  }

  /** Detect a stripe-node call. Returns zero or more sites (wrappers fan out to callers). */
  sitesFor(node: ts.CallExpression, siteOf: (n: ts.Node) => { file: string; line: number; column: number }): ApiCallSite[] | null {
    if (!ts.isPropertyAccessExpression(node.expression)) return null;
    const names: string[] = [];
    let e: ts.Expression = node.expression;
    let computed: ts.Expression | null = null;
    while (true) {
      if (ts.isPropertyAccessExpression(e)) { names.unshift(e.name.text); e = e.expression; }
      else if (ts.isElementAccessExpression(e)) {
        if (ts.isStringLiteralLike(e.argumentExpression)) { names.unshift(e.argumentExpression.text); e = e.expression; }
        else { computed = e.expression; break; }
      } else break;
      const ev = this.tryRoot(e, names);
      if (ev) return this.buildSites(node, ev.sdk, ev.evidence, siteOf);
    }
    if (computed) {
      const ev = this.clientEvidence(computed);
      if (ev) return [{ ...siteOf(node), call: "stripe-sdk", method: null, path: null, host: "api.stripe.com", sdkMethod: "<computed>." + names.join("."), payload: { ...emptyPayload("unknown"), unresolved: ["computed SDK resource"], via: [ev] }, reason: "UNKNOWN: computed stripe resource; endpoint cannot be determined statically" }];
    }
    return null;
  }

  private tryRoot(root: ts.Expression, names: string[]): { sdk: string; evidence: string } | null {
    const sdk = names.join(".");
    if (!METHODS[sdk]) return null;
    const ev = this.clientEvidence(root);
    return ev ? { sdk, evidence: ev } : null;
  }

  private buildSites(node: ts.CallExpression, sdk: string, evidence: string, siteOf: (n: ts.Node) => { file: string; line: number; column: number }): ApiCallSite[] {
    const [method, path] = METHODS[sdk]!;
    const idx = (path.match(/\{\*\}/g) ?? []).length;
    const arg = node.arguments[idx];
    const mk = (at: ts.Node, payload: PayloadEvidence, extraVia: string[] = [], reason?: string): ApiCallSite => ({
      ...siteOf(at), call: "stripe-sdk", method, path, host: "api.stripe.com", sdkMethod: sdk,
      payload: { ...payload, via: [evidence, ...extraVia, ...payload.via] }, ...(reason ? { reason } : {}),
    });
    if (!arg) return [mk(node, emptyPayload("resolved"))];
    const a = unwrap(arg);
    if (ts.isObjectLiteralExpression(a)) return [mk(node, fromObjectLiteral(a, this.resolver))];
    if (ts.isIdentifier(a)) {
      const r = this.resolver(a);
      if (r && ts.isObjectLiteralExpression(unwrap(r.node))) return [mk(node, fromObjectLiteral(unwrap(r.node) as ts.ObjectLiteralExpression, this.resolver), [r.via])];
      // wrapper: params object is a parameter of the enclosing function
      const s = this.checker.getSymbolAtLocation(a);
      const param = s?.declarations?.find(ts.isParameter);
      if (param && ts.isFunctionLike(param.parent)) {
        const fn = param.parent as ts.FunctionLikeDeclaration;
        const pIndex = fn.parameters.indexOf(param);
        const fnSym = fn.name ? this.checker.getSymbolAtLocation(fn.name) : ts.isVariableDeclaration(fn.parent) ? this.checker.getSymbolAtLocation(fn.parent.name) : undefined;
        const callers = fnSym ? (this.calls().get(fnSym) ?? []) : [];
        if (callers.length === 0) {
          return [mk(node, { ...emptyPayload("unknown"), unresolved: ["wrapper parameter " + a.text + " has no in-repo callers"] })];
        }
        const wrapperVia = "wrapper " + (fn.name?.getText() ?? "fn") + "(" + a.text + ") -> " + sdk + " at " + loc(node);
        return callers.map((c) => {
          const ca = c.arguments[pIndex] ? unwrap(c.arguments[pIndex]!) : undefined;
          const p = ca && ts.isObjectLiteralExpression(ca) ? fromObjectLiteral(ca, this.resolver) : { ...emptyPayload("unknown"), unresolved: ["wrapper argument not a static object"] };
          return mk(c, p, [wrapperVia]);
        });
      }
    }
    return [mk(node, { ...emptyPayload("unknown"), unresolved: ["params: " + arg.getText().slice(0, 60)] }, [], "UNKNOWN: params object is not statically resolvable")];
  }
}
