/**
 * LeakShield before/after + gitleaks comparison on a runtime-generated synthetic fixture.
 *   npx tsx bench/leakshield/run.ts [--legacy-src <9ca85cf>/packages/scanner-core/src] [--gitleaks <bin>] [--out f.json]
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
// @ts-expect-error plain ESM helper
import { makeFixture } from "./make-fixture.mjs";
import { scanPathForSecrets } from "../../src/secrets.js";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : undefined; };
type T = { file: string; line: number; provider: string; kind: string; placeholder?: string };

function score(name: string, truth: T[], found: { file: string; line: number; severity?: string; confidence?: string; state?: string }[]) {
  const at = (t: T) => found.filter((f) => f.file === t.file && f.line === t.line);
  const random = truth.filter((t) => t.kind === "random"), inTest = truth.filter((t) => t.kind === "random-in-test-path"), ph = truth.filter((t) => t.kind === "placeholder");
  const missed = random.filter((t) => at(t).length === 0).map((t) => t.provider);
  return {
    tool: name,
    randomDetected: random.length - missed.length, randomTotal: random.length, randomMissed: missed,
    testPathDetected: inTest.filter((t) => at(t).length > 0).length, testPathTotal: inTest.length,
    placeholdersFlagged: ph.filter((t) => at(t).length > 0).length,
    placeholdersCritical: ph.filter((t) => at(t).some((f) => f.severity === "Critical")).length,
    placeholdersHighOrCritical: ph.filter((t) => at(t).some((f) => f.severity === "Critical" || f.severity === "High")).length,
    placeholderTotal: ph.length,
    confirmedLabels: found.filter((f) => f.confidence === "confirmed").length,
    verifiedValidLabels: found.filter((f) => f.state === "verified_valid").length,
    findings: found.length,
  };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "leakshield-bench-"));
  try {
    const truth: T[] = makeFixture(dir);
    const results = [score("rakshex-current", truth, scanPathForSecrets(dir))];
    const legacySrc = flag("legacy-src");
    if (legacySrc) {
      const legacy = await import(pathToFileURL(resolve(legacySrc, "secrets.ts")).href);
      results.push(score("rakshex-legacy", truth, legacy.scanPathForSecrets(dir)));
    }
    const gl = flag("gitleaks");
    if (gl && existsSync(gl)) {
      const report = join(dir, "..", "gl-" + Date.now() + ".json");
      const p = spawnSync(gl, ["dir", dir, "--report-format", "json", "--report-path", report, "--redact", "--exit-code", "0", "--no-banner"], { encoding: "utf8" });
      if (p.status !== 0) throw new Error("gitleaks failed: " + p.stderr.slice(-300));
      const g = JSON.parse(readFileSync(report, "utf8")) as { File: string; StartLine: number }[];
      rmSync(report, { force: true });
      results.push(score("gitleaks", truth, g.map((x) => ({ file: x.File.replace(dir + "/", ""), line: x.StartLine }))));
    } else results.push({ tool: "gitleaks", status: "NOT RUN (binary not provided)" } as never);
    results.push({ tool: "trufflehog", status: "BLOCKED: not run (earlier build was interrupted; not installed on this box)" } as never);
    const out = { generatedAt: new Date().toISOString(), seed: 20261015, items: truth.length, results };
    const o = flag("out"); if (o) writeFileSync(o, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(results, null, 1));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
main().catch((e) => { console.error(e); process.exit(2); });
