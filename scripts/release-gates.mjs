#!/usr/bin/env node
/**
 * Part C release gate runner — foundation paths (monorepo).
 * Usage: node scripts/release-gates.mjs
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGE_TESTS = [
  "packages/scanner-core",
  "packages/policy-engine",
  "packages/risk-baseline",
  "packages/agent-graph",
  "packages/siem-export",
];

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  return r.status === 0;
}

console.log("\n═══ Rakshex Part C — Release Gates (foundation) ═══\n");

let failed = 0;

for (const pkg of PACKAGE_TESTS) {
  const cfg = path.join(root, pkg, "vitest.config.ts");
  if (!existsSync(cfg)) {
    console.log(`✗ ${pkg} — missing vitest.config.ts`);
    failed += 1;
    continue;
  }
  console.log(`→ test ${pkg}`);
  const ok = run("pnpm", [
    "exec",
    "vitest",
    "run",
    "--config",
    path.join(pkg, "vitest.config.ts"),
  ]);
  if (!ok) {
    console.log(`✗ ${pkg} tests failed`);
    failed += 1;
  } else {
    console.log(`✓ ${pkg} tests passed`);
  }
}

console.log("→ tenant isolation tests");
const isoOk = run("pnpm", [
  "exec",
  "vitest",
  "run",
  "--config",
  "apps/api/vitest.config.ts",
  "apps/api/services/tenantIsolation.test.ts",
  "apps/api/services/rbac.test.ts",
]);
if (!isoOk) {
  console.log("✗ tenant isolation / rbac tests failed");
  failed += 1;
} else {
  console.log("✓ tenant isolation + rbac tests passed");
}

console.log("\n── Decision ──");
if (failed > 0) {
  console.log(`FAIL — ${failed} automated gate(s) red.\n`);
  process.exit(1);
}
console.log("PASS (automated subset)\n");
process.exit(0);
