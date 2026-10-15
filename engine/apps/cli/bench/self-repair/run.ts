/**
 * Self-Repair impact accuracy benchmark.
 *   npx tsx bench/self-repair/run.ts [--engine current|legacy] [--legacy-src <dir with apiImpact.ts>] [--out file.json] [--set repos|heldout]
 * Needs: network once (spec download, hash-verified) and the oasdiff binary on PATH.
 * Metrics are computed against hand-written ground truth on SYNTHETIC repos only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runOasdiff, type OasdiffChange } from "../../src/oasdiffAdapter.js";
import { analyzeApiImpact } from "../../src/apiImpact.js";
import { isRequestSide, changedProperty, normalizeConsumerImpact } from "../../src/consumerImpact.js";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, ".cache");
const lock = JSON.parse(readFileSync(join(here, "specs.lock.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
const engine = flag("engine") ?? "current";

async function spec(tag: string): Promise<string> {
  const s = lock.specs[tag];
  const file = join(cache, tag + ".spec3.json");
  mkdirSync(cache, { recursive: true });
  if (!existsSync(file)) {
    const res = await fetch(s.url);
    if (!res.ok) throw new Error("download failed " + s.url + " " + res.status);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (sha !== s.sha256) throw new Error("SHA-256 mismatch for " + tag + ": " + sha);
  return file;
}

function changesFor(pair: string, before: string, after: string): OasdiffChange[] {
  const file = join(cache, pair + ".oasdiff.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const r = runOasdiff(before, after, { maxOutputMib: 128 });
  writeFileSync(file, JSON.stringify(r.changes));
  return r.changes;
}

type Claim = { file: string; line: number; method: string; path: string; property: string | null };
const key = (c: { file: string; line: number; method?: string; path?: string; property?: string | null }) => [c.file, c.line, c.method, c.path, c.property].join("|");

async function main() {
  const legacyDir = flag("legacy-src");
  const legacy = engine === "legacy" ? await import(pathToFileURL(resolve(legacyDir!, "apiImpact.ts")).href) : null;
  const reposDir = join(here, flag("set") === "heldout" ? "heldout" : "repos");
  const results: any[] = [];
  const pairs = lock.pairs as Record<string, { before: string; after: string }>;
  const changeCache: Record<string, OasdiffChange[]> = {};
  for (const repo of readdirSync(reposDir).sort().filter((d) => existsSync(join(reposDir, d, "truth.json")))) {
    const truth = JSON.parse(readFileSync(join(reposDir, repo, "truth.json"), "utf8"));
    const p = pairs[truth.pair]!;
    changeCache[truth.pair] ??= changesFor(truth.pair, await spec(p.before), await spec(p.after));
    const changes = changeCache[truth.pair]!;
    const root = join(reposDir, repo);
    let affected: Claim[] = [], unresolved: { file: string; line: number }[] = [], shown = 0, warnings: { file: string; line: number }[] = [];
    if (legacy) {
      const rep = legacy.analyzeApiImpact(root, changes);
      const req = changes.filter((c) => isRequestSide(c.id));
      for (const m of rep.matches) {
        for (const c of req) if (c.operation === m.method && c.path === m.path && c.id === m.rule)
          affected.push({ file: m.file, line: m.line, method: m.method, path: m.path, property: changedProperty(c.text) });
      }
      shown = rep.matches.length;
    } else {
      const rep = analyzeApiImpact(root, changes, { hosts: ["api.stripe.com"] });
      const ci = normalizeConsumerImpact(changes, rep.sites);
      for (const i of ci.impacts) {
        if (i.verdict === "breaks_call" || i.verdict === "possibly_breaks") affected.push({ ...i.site, method: i.change.method, path: i.change.path, property: i.change.property });
        if (i.verdict === "unresolved") unresolved.push(i.site);
        if (i.semanticWarning) warnings.push(i.site);
      }
      for (const s of rep.sites) if (s.method === null || s.path === null) unresolved.push(s);
      shown = ci.impacts.length;
    }
    const claimKeys = new Set(affected.map(key));
    const truthKeys = new Set(truth.affected.map(key));
    const tp = [...truthKeys].filter((k) => claimKeys.has(k)).length;
    const fpList = [...claimKeys].filter((k) => !truthKeys.has(k));
    const unresolvedSites = new Set(unresolved.map((u) => u.file + ":" + u.line));
    const fnList = truth.affected.filter((t: Claim) => !claimKeys.has(key(t)));
    const fnFlagged = fnList.filter((t: Claim) => unresolvedSites.has(t.file + ":" + t.line)).length;
    const unkHit = truth.unknown.filter((u: any) => unresolvedSites.has(u.file + ":" + u.line)).length;
    const warnHit = (truth.semanticWarning ?? []).filter((w: any) => warnings.some((x) => x.file === w.file && x.line === w.line)).length;
    results.push({
      repo, pair: truth.pair, totalChanges: changes.length, itemsShown: shown,
      truthAffected: truthKeys.size, tp, fp: fpList.length, fn: fnList.length, fnReportedUnresolved: fnFlagged, fnSilent: fnList.length - fnFlagged,
      precision: tp + fpList.length ? +(tp / (tp + fpList.length)).toFixed(3) : null,
      recall: truthKeys.size ? +(tp / truthKeys.size).toFixed(3) : null,
      unknownTruth: truth.unknown.length, unknownReported: unkHit,
      semanticWarningsExpected: (truth.semanticWarning ?? []).length, semanticWarningsKept: engine === "legacy" ? 0 : warnHit,
      falsePositives: fpList, falseNegatives: fnList.map(key),
    });
  }
  const sum = (k: string) => results.reduce((a, r) => a + (r[k] ?? 0), 0);
  const tot = { tp: sum("tp"), fp: sum("fp"), fn: sum("fn"), fnSilent: sum("fnSilent"), truthAffected: sum("truthAffected"), unknownTruth: sum("unknownTruth"), unknownReported: sum("unknownReported") };
  const out = { engine, generatedAt: new Date().toISOString(), totals: { ...tot, precision: tot.tp + tot.fp ? +(tot.tp / (tot.tp + tot.fp)).toFixed(3) : null, recall: +(tot.tp / tot.truthAffected).toFixed(3), unknownCoverage: tot.unknownTruth ? +(tot.unknownReported / tot.unknownTruth).toFixed(3) : null }, results };
  const o = flag("out");
  if (o) writeFileSync(o, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out.totals));
  for (const r of results) console.log(r.repo, "tp", r.tp, "fp", r.fp, "fn", r.fn, "(silent", r.fnSilent + ")", "unknown", r.unknownReported + "/" + r.unknownTruth, "shown", r.itemsShown, "of", r.totalChanges, "warn", r.semanticWarningsKept + "/" + r.semanticWarningsExpected);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(2); });
