import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";

export interface PatchTarget { file: string; line: number; removed: string; added: string }
export interface FileEdit { file: string; before: string; after: string }
export interface PatchResult { edits: FileEdit[]; diff: string; sha256: string }

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function inside(root: string, file: string): string {
  const abs = resolve(root, file);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`refusing to patch outside repo: ${file}`);
  return abs;
}

/**
 * Bounded codemod: rename exactly one object-literal key per target, inside the call that
 * starts on `line`. Throws (never guesses) if the key is not found exactly once there.
 */
export function planPatch(root: string, targets: PatchTarget[]): PatchResult {
  const byFile = new Map<string, PatchTarget[]>();
  for (const t of targets) byFile.set(t.file, [...(byFile.get(t.file) ?? []), t]);
  const edits: FileEdit[] = [];
  for (const [file, ts_] of [...byFile].sort(([a], [b]) => a.localeCompare(b))) {
    const abs = inside(root, file);
    const before = readFileSync(abs, "utf8");
    const sf = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, true);
    const repl: { start: number; end: number; text: string }[] = [];
    for (const t of ts_) {
      const hits: ts.PropertyName[] = [];
      const visitCall = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 === t.line) {
          const scan = (m: ts.Node): void => {
            if (ts.isPropertyAssignment(m) || ts.isShorthandPropertyAssignment(m)) {
              const nm = m.name;
              const text = ts.isIdentifier(nm) || ts.isStringLiteral(nm) ? nm.text : null;
              if (text === t.removed) hits.push(nm);
            }
            if (!ts.isFunctionLike(m)) ts.forEachChild(m, scan);
          };
          n.arguments.forEach(scan);
          return;
        }
        ts.forEachChild(n, visitCall);
      };
      visitCall(sf);
      if (hits.length !== 1) throw new Error(`patch target ${file}:${t.line} has ${hits.length} \`${t.removed}\` keys; refusing to guess`);
      const nm = hits[0]!;
      const p = nm.parent;
      if (ts.isShorthandPropertyAssignment(p)) repl.push({ start: nm.getStart(sf), end: nm.getEnd(), text: `${t.added}: ${t.removed}` });
      else repl.push({ start: nm.getStart(sf), end: nm.getEnd(), text: ts.isStringLiteral(nm) ? JSON.stringify(t.added) : t.added });
    }
    let after = before;
    for (const r of repl.sort((a, b) => b.start - a.start)) after = after.slice(0, r.start) + r.text + after.slice(r.end);
    edits.push({ file, before, after });
  }
  const diff = edits.map(unifiedDiff).join("");
  return { edits, diff, sha256: sha(diff) };
}

export function applyPatch(root: string, p: PatchResult): void {
  for (const e of p.edits) {
    const abs = inside(root, e.file);
    if (readFileSync(abs, "utf8") !== e.before) throw new Error(`file changed since plan: ${e.file}`);
    writeFileSync(abs, e.after);
  }
}

/** Unified diff with 3 lines of context (same line count both sides) -- deterministic and `git apply`-able. */
export function unifiedDiff(e: FileEdit): string {
  const a = e.before.split("\n"), b = e.after.split("\n");
  if (a.length !== b.length) throw new Error("line count changed; bounded rename must not add lines");
  const changed = a.map((l, i) => (l !== b[i] ? i : -1)).filter((i) => i >= 0);
  if (!changed.length) return "";
  const C = 3, hunks: [number, number][] = [];
  for (const i of changed) {
    const lo = Math.max(0, i - C), hi = Math.min(a.length - 1, i + C);
    const last = hunks[hunks.length - 1];
    if (last && lo <= last[1] + 1) last[1] = hi; else hunks.push([lo, hi]);
  }
  let out = `--- a/${e.file}\n+++ b/${e.file}\n`;
  for (const [lo, hi] of hunks) {
    // a trailing "" element is the final newline, not a line
    const end = Math.min(hi, a[a.length - 1] === "" ? a.length - 2 : a.length - 1);
    const n = end - lo + 1;
    out += `@@ -${lo + 1},${n} +${lo + 1},${n} @@\n`;
    for (let i = lo; i <= end; i++) out += a[i] === b[i] ? ` ${a[i]}\n` : `-${a[i]}\n+${b[i]}\n`;
  }
  return out;
}
