#!/usr/bin/env node
/**
 * Local market-readiness gate runner.
 * Exit non-zero on first failure. Does not claim GA — prints checklist.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

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
const requiredEvidence = [
  "docs/operations/RELEASE_EVIDENCE_TEMPLATE.md",
  "docs/operations/LAUNCH_SIGNOFF_MATRIX.md",
  "docs/operations/LEGAL_LAUNCH_SIGNOFF.md",
  "docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md",
];

console.log("\n═══ Rakshex market-ready check ═══\n");
console.log("Evidence guard: automated gates never imply public launch approval.\n");

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

const missingEvidence = requiredEvidence.filter(
  (file) => !process.env.RELEASE_EVIDENCE_DIR && !process.env.CI && !existsSync(file),
);
const publicLaunch = process.env.PUBLIC_LAUNCH === "1";
if (publicLaunch && missingEvidence.length > 0) {
  console.log(
    `RESULT: NOT READY — missing release evidence files:\n${missingEvidence.map((file) => `  - ${file}`).join("\\n")}`,
  );
  process.exit(1);
}

console.log(`RESULT: AUTOMATED GATES GREEN
Still required for public launch:
  - Staging primary journey sign-off (docs/RELEASE_CHECKLIST.md)
  - GitHub Actions release-gate green on remote
  - Completed docs/operations/RELEASE_EVIDENCE_TEMPLATE.md for this exact SHA
  - All rows in docs/operations/LAUNCH_SIGNOFF_MATRIX.md approved
  - Legal signoff and claims register review
  - Live Stripe/Razorpay only if shipping paid plans
  - Live GitHub App only if shipping PR scans
`);
process.exit(0);
