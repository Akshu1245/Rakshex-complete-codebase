#!/usr/bin/env node
/**
 * Local market-readiness gate runner.
 * Exit non-zero on first failure. Does not claim GA — prints checklist.
 */
import { spawnSync } from "node:child_process";

const steps = [
  ["install", ["install", "--frozen-lockfile"]],
  ["format", ["format:check"]],
  ["lint", ["lint"]],
  ["typecheck", ["typecheck"]],
  ["test", ["test"]],
  ["test:security", ["test:security"]],
  ["test:integration", ["test:integration"]],
  ["build", ["build"]],
];

// A live smoke check is meaningful only when the caller supplies the staging
// target. Keeping it out of the default local run avoids testing an unrelated
// process that happens to occupy localhost:3000.
if (process.env.SMOKE_BASE_URL) {
  steps.push(["smoke:test", ["smoke:test"]]);
}

let failed = 0;
console.log("\n═══ Rakshex market-ready check ═══\n");

for (const [name, cmd] of steps) {
  console.log(`→ ${name}`);
  // Corepack honors package.json#packageManager, preventing a globally
  // installed pnpm version from invalidating a CI-frozen lockfile.
  const r = spawnSync("corepack", ["pnpm", ...cmd], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    console.log(`✗ ${name} FAILED (exit ${r.status})\n`);
    failed += 1;
    break;
  }
  console.log(`✓ ${name}\n`);
}

if (failed) {
  console.log("RESULT: NOT READY — fix failing gate above.");
  process.exit(1);
}

console.log(`RESULT: AUTOMATED GATES GREEN
Still required for public launch:
  - Staging primary journey sign-off (docs/RELEASE_CHECKLIST.md)
  - GitHub Actions release-gate green on remote
  - Live Stripe/Razorpay only if shipping paid plans
  - Live GitHub App only if shipping PR scans
`);
process.exit(0);
