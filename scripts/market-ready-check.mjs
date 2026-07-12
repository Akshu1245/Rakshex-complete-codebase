#!/usr/bin/env node
/**
 * Local market-readiness gate runner.
 * Exit non-zero on first failure. Does not claim GA — prints checklist.
 */
import { spawnSync } from "node:child_process";

const steps = [
  ["install", ["pnpm", "install", "--frozen-lockfile"]],
  ["format", ["pnpm", "format:check"]],
  ["lint", ["pnpm", "lint"]],
  ["typecheck", ["pnpm", "typecheck"]],
  ["test", ["pnpm", "test"]],
  ["test:security", ["pnpm", "test:security"]],
  ["test:integration", ["pnpm", "test:integration"]],
  ["build", ["pnpm", "build"]],
  ["smoke:test", ["pnpm", "smoke:test"]],
];

let failed = 0;
console.log("\n═══ Rakshex market-ready check ═══\n");

for (const [name, cmd] of steps) {
  console.log(`→ ${name}`);
  const r = spawnSync(cmd[0], cmd.slice(1), {
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
