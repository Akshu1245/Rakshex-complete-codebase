// Generates a SYNTHETIC secret-scanning fixture at runtime (never committed, so no token-shaped
// literals live in git). Bodies come from a seeded PRNG: random, never issued by any provider.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

export function makeFixture(out, seed = 20261015) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pick = (set, n) => Array.from({ length: n }, () => set[Math.floor(rnd() * set.length)]).join("");
  const AN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0234567";
  const j = (...p) => p.join("");
  const providers = [
    { p: "aws", pre: j("AK", "IA"), body: () => pick(UP, 16) },
    { p: "github-pat", pre: j("gh", "p_"), body: () => pick(AN, 36) },
    { p: "github-fine-grained", pre: j("github", "_pat_"), body: () => pick(AN, 22) + "_" + pick(AN, 59) },
    { p: "openai-project", pre: j("sk", "-proj-"), body: () => pick(AN + "-_", 48) + "T3Blbk" + pick(AN, 20) },
    { p: "openai-legacy", pre: j("sk", "-"), body: () => pick(AN, 48) },
    { p: "anthropic", pre: j("sk", "-ant-api03-"), body: () => pick(AN + "-_", 90) },
    { p: "slack-bot", pre: j("xo", "xb-"), body: () => pick("0123456789", 12) + "-" + pick("0123456789", 13) + "-" + pick(AN, 24) },
    { p: "stripe-live", pre: j("sk", "_live_"), body: () => pick(AN, 32) },
    { p: "stripe-restricted", pre: j("rk", "_live_"), body: () => pick(AN, 32) },
    { p: "stripe-test", pre: j("sk", "_test_"), body: () => pick(AN, 32) },
  ];
  const placeholders = [
    { k: "word-fake", body: (n) => "FAKE" + "abcd".repeat(Math.ceil(n / 4)).slice(0, n - 4) },
    { k: "repeated-zero", body: (n) => "0".repeat(n) },
    { k: "sequence", body: (n) => "1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz".slice(0, n) },
    { k: "word-example", body: (n) => ("EXAMPLE" + "X".repeat(n)).slice(0, n) },
  ];
  const truth = [];
  const files = {};
  const add = (file, text, meta) => { files[file] ??= []; files[file].push(text); truth.push({ file, line: files[file].length, ...meta }); };
  for (const pr of providers) {
    const v = pr.pre + pr.body();
    add("src/config/" + pr.p + ".ts", `export const KEY = "${v}";`, { provider: pr.p, kind: "random" });
    for (const ph of placeholders) {
      const n = pr.body().length;
      add("src/config/" + pr.p + ".ts", `export const ${ph.k.replace("-", "_").toUpperCase()} = "${pr.pre + ph.body(n)}"; // placeholder`, { provider: pr.p, kind: "placeholder", placeholder: ph.k });
    }
    add("tests/fixtures/" + pr.p + ".ts", `export const KEY = "${pr.pre + pr.body()}";`, { provider: pr.p, kind: "random-in-test-path" });
  }
  for (const [f, lines] of Object.entries(files)) { mkdirSync(dirname(join(out, f)), { recursive: true }); writeFileSync(join(out, f), lines.join("\n") + "\n"); }
  writeFileSync(join(out, "truth.json"), JSON.stringify(truth, null, 1));
  return truth;
}
