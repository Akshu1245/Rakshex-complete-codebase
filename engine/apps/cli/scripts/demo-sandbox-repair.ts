/**
 * Demo: run the ONE Self-Repair pipeline (cli detection + @rakshex/self-repair) against a
 * SYNTHETIC app in a local clone of the sandbox repo. Writes report.json, PR_BODY.md, patch.diff.
 * It never pushes, never calls Stripe, never reads a key.
 *   npx tsx scripts/demo-sandbox-repair.ts <sandbox-clone> <app-subdir> <out-dir>
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { repairFromContractChanges, STRIPE_ENDIVE_RULES } from "../src/selfRepairRun.js";

const here = dirname(fileURLToPath(import.meta.url));
const [clone, sub, out] = process.argv.slice(2).map((x) => resolve(x));
if (!clone || !sub || !out) { console.error("usage: <sandbox-clone> <app-subdir> <out-dir>"); process.exit(2); }
const appDir = join(clone, process.argv[3]!);
const cache = join(here, "..", "bench", "self-repair", ".cache", "stripe-v2516-v2517.oasdiff.json");
if (!existsSync(cache)) { console.error("run bench/self-repair/run.ts first (pinned specs + oasdiff)"); process.exit(2); }
const changes = JSON.parse(readFileSync(cache, "utf8"));
const baseSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: clone, encoding: "utf8" }).trim();

const ws = mkdtempSync(join(tmpdir(), "rakshex-demo-ws-"));
cpSync(appDir, ws, { recursive: true, filter: (s) => !s.includes("node_modules") });
const bin = (n: string) => join(here, "..", "..", "..", "node_modules", ".bin", n);
const r = repairFromContractChanges(ws, changes, {
  title: "Stripe 2026-09-30.endive: Checkout payment_method_types -> allowed_payment_method_types",
  repo: "Akshu1245/rakshex-self-repair-sandbox", baseSha, workspaceId: "sandbox-demo",
  rules: STRIPE_ENDIVE_RULES,
  checks: [
    { name: "npm install (stripe from patched package.json)", cmd: "npm", args: ["install", "--no-audit", "--no-fund"], cwd: ws },
    { name: "check tooling: npm install --no-save @types/node@22 (not part of the patch)", cmd: "npm", args: ["install", "--no-save", "--no-audit", "--no-fund", "@types/node@22"], cwd: ws },
    { name: "typecheck (tsc)", cmd: bin("tsc"), args: ["-p", "tsconfig.json"], cwd: ws },
    { name: "unit tests vs local Endive mock", cmd: bin("tsx"), args: ["--test", "test/checkout.test.ts"], cwd: ws },
  ],
  checksNotRun: [
    { name: "Real Stripe API (test or live)", reason: "not run by design; local mock only" },
    { name: "Stripe Dashboard payment-method settings", reason: "no Dashboard access; RaksHex never changes them" },
    { name: "Webhook endpoint API-version upgrade", reason: "out of scope" },
  ],
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "report.json"), JSON.stringify({ ...r, patch: r.patch && { sha256: r.patch.sha256, files: r.patch.edits.map((e) => e.file) }, baseSha, appDir: sub }, null, 2));
writeFileSync(join(out, r.status === "DRAFT_PR_READY" ? "PR_BODY.md" : "REVIEW_REQUIRED.md"), r.body);
if (r.patch) writeFileSync(join(out, "patch.diff"), r.patch.diff);
console.log(JSON.stringify({ status: r.status, sites: r.assessments.map((a) => [a.id, a.level]), checks: r.checks.map((c) => [c.name, c.status]), patchSha256: r.patchSha256, problems: r.problems }, null, 1));
