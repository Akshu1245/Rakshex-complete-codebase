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
import { randomBytes } from "node:crypto";
import { scanPathForSecrets, scanTextForSecrets } from "../../src/secrets.js";

/** Large random sample: realistic tokens with embedded placeholder words; fraction still gated (High/Critical). */
function adversarialSample(scan: (t: string, f: string) => { severity: string }[], n = 2000) {
  const AN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const r = (k: number, set = AN) =>
    Array.from(randomBytes(k), (b) => set[b % set.length]).join("");
  const j = (...p: string[]) => p.join("");
  const fmts: [string, (w: string) => string][] = [
    ["stripe-live", (w) => j("sk", "_live_") + r(14) + w + r(14)],
    ["github-pat", (w) => j("gh", "p_") + r(16) + w + r(20)],
    ["openai-project", (w) => j("sk", "-proj-") + r(30) + w + r(30)],
    ["anthropic", (w) => j("sk", "-ant-api03-") + r(40) + w + r(40)],
    [
      "aws(16-char body)",
      (w) => j("AK", "IA") + (r(9, UP) + w.toUpperCase() + r(16, UP)).slice(0, 16),
    ],
  ];
  const words = ["example", "test", "fake", "dummy", "sample", "EXAMPLE", "placeholder"];
  const out: Record<string, string> = {};
  for (const [name, gen] of fmts) {
    let gated = 0,
      total = 0;
    for (let i = 0; i < n; i++) {
      const f = scan(
        `k = "${gen(words[i % words.length]!)}" // fake example`,
        i % 2 ? "tests/fixtures/a.ts" : "src/a.ts",
      );
      total++;
      if (f.some((x) => x.severity === "Critical" || x.severity === "High")) gated++;
    }
    out[name] = `${gated}/${total} gated (High/Critical)`;
  }
  return out;
}

const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf("--" + n);
  return i >= 0 ? args[i + 1] : undefined;
};
type T = { file: string; line: number; provider: string; kind: string; placeholder?: string };

function score(
  name: string,
  truth: T[],
  found: { file: string; line: number; severity?: string; confidence?: string; state?: string }[],
) {
  const at = (t: T) => found.filter((f) => f.file === t.file && f.line === t.line);
  const random = truth.filter((t) => t.kind === "random"),
    inTest = truth.filter((t) => t.kind === "random-in-test-path"),
    ph = truth.filter((t) => t.kind === "placeholder");
  const adv = truth.filter((t) => t.kind === "adversarial-embedded-word"),
    dummy = truth.filter((t) => t.kind === "known-dummy");
  const hc = (t: T) => at(t).some((f) => f.severity === "Critical" || f.severity === "High");
  const missed = random.filter((t) => at(t).length === 0).map((t) => t.provider);
  return {
    tool: name,
    randomDetected: random.length - missed.length,
    randomTotal: random.length,
    randomMissed: missed,
    testPathDetected: inTest.filter((t) => at(t).length > 0).length,
    testPathTotal: inTest.length,
    placeholdersFlagged: ph.filter((t) => at(t).length > 0).length,
    placeholdersCritical: ph.filter((t) => at(t).some((f) => f.severity === "Critical")).length,
    placeholdersHighOrCritical: ph.filter((t) =>
      at(t).some((f) => f.severity === "Critical" || f.severity === "High"),
    ).length,
    placeholderTotal: ph.length,
    adversarialDetected: adv.filter((t) => at(t).length > 0).length,
    adversarialHighOrCritical: adv.filter(hc).length,
    adversarialDowngradedBelowHigh: adv.filter((t) => at(t).length > 0 && !hc(t)).length,
    adversarialTotal: adv.length,
    knownDummyFlagged: dummy.filter((t) => at(t).length > 0).length,
    knownDummyCritical: dummy.filter((t) => at(t).some((f) => f.severity === "Critical")).length,
    knownDummyHighOrCritical: dummy.filter(hc).length,
    knownDummyTotal: dummy.length,
    confirmedLabels: found.filter((f) => f.confidence === "confirmed").length,
    verifiedValidLabels: found.filter((f) => f.state === "verified_valid").length,
    findings: found.length,
  };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "leakshield-bench-"));
  try {
    const truth: T[] = makeFixture(dir);
    const results: unknown[] = [
      {
        ...score("rakshex-current", truth, scanPathForSecrets(dir)),
        adversarialSample: adversarialSample(scanTextForSecrets),
      },
    ];
    for (const [label, key] of [
      ["rakshex-pr244-before", "before-src"],
      ["rakshex-legacy", "legacy-src"],
    ] as const) {
      const src = flag(key);
      if (!src) continue;
      const mod = await import(pathToFileURL(resolve(src, "secrets.ts")).href);
      results.push({
        ...score(label, truth, mod.scanPathForSecrets(dir)),
        adversarialSample: adversarialSample(mod.scanTextForSecrets),
      });
    }
    const gl = flag("gitleaks");
    if (gl && existsSync(gl)) {
      const report = join(dir, "..", "gl-" + Date.now() + ".json");
      const p = spawnSync(
        gl,
        [
          "dir",
          dir,
          "--report-format",
          "json",
          "--report-path",
          report,
          "--redact",
          "--exit-code",
          "0",
          "--no-banner",
        ],
        { encoding: "utf8" },
      );
      if (p.status !== 0) throw new Error("gitleaks failed: " + p.stderr.slice(-300));
      const g = JSON.parse(readFileSync(report, "utf8")) as { File: string; StartLine: number }[];
      rmSync(report, { force: true });
      results.push(
        score(
          "gitleaks",
          truth,
          g.map((x) => ({ file: x.File.replace(dir + "/", ""), line: x.StartLine })),
        ),
      );
    } else results.push({ tool: "gitleaks", status: "NOT RUN (binary not provided)" } as never);
    results.push({
      tool: "trufflehog",
      status: "BLOCKED: not run (earlier build was interrupted; not installed on this box)",
    } as never);
    const out = {
      generatedAt: new Date().toISOString(),
      seed: 20261015,
      items: truth.length,
      results,
    };
    const o = flag("out");
    if (o) writeFileSync(o, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(results, null, 1));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
