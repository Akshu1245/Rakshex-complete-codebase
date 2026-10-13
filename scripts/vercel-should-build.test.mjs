import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateVercelShouldBuild } from "./vercel-should-build.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "vercel-should-build.mjs");

function run(env) {
  try {
    execFileSync(process.execPath, [script], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return 0;
  } catch (err) {
    return err.status ?? 1;
  }
}

test("skips duplicate rakshex-ui project", () => {
  const result = evaluateVercelShouldBuild({
    projectName: "rakshex-ui",
    previousSha: "41329bdfb6f6008b07fe6c6fa3379014f8fc189d",
    currentSha: "5d0431d5a3eeb05c75c13eee622e46980d3e2105",
    changedFiles: ["apps/cli/src/index.ts"],
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.message, /rakshex-ui/);
});

test("skips web deploy when diff is CLI-only", () => {
  const result = evaluateVercelShouldBuild({
    projectName: "rakshex",
    previousSha: "41329bdfb6f6008b07fe6c6fa3379014f8fc189d",
    currentSha: "5d0431d5a3eeb05c75c13eee622e46980d3e2105",
    changedFiles: [
      ".github/workflows/ci.yml",
      "apps/cli/src/apiDiff.test.ts",
      "apps/cli/src/apiDiff.ts",
      "apps/cli/src/index.ts",
      "docs/YC13_API_GUARDIAN_CONTRACT_DIFF_MVP.md",
    ],
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.message, /no web-relevant files changed/);
});

test("skips web deploy for YC13 apiImpact-only merge (593e2abd)", () => {
  const result = evaluateVercelShouldBuild({
    projectName: "rakshex",
    previousSha: "40fa44049bc965ab875c0547cc5cb249e0023e4a",
    currentSha: "593e2abd93e472a2f14465bdd2f0fb5dc7fe9d5f",
    changedFiles: [
      "apps/cli/src/apiDiff.ts",
      "apps/cli/src/apiImpact.process.test.ts",
      "apps/cli/src/apiImpact.test.ts",
      "apps/cli/src/apiImpact.ts",
      "apps/cli/src/index.ts",
      "docs/YC13_API_GUARDIAN_CONTRACT_DIFF_MVP.md",
    ],
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.message, /no web-relevant files changed/);
});

test("proceeds when apps/web changes", () => {
  const result = evaluateVercelShouldBuild({
    projectName: "rakshex",
    previousSha: "e523ecdd6bac50ff1f517b496b8e7f2a26693a4b",
    currentSha: "e61014f9aeb25e89358c83f843c0e5cd8a8fe507",
    changedFiles: ["apps/web/src/app/page.tsx"],
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.message, /Proceeding with web build/);
});

test("skips legacy *-api Vercel project", () => {
  const result = evaluateVercelShouldBuild({
    projectName: "rakshex-complete-codebase-api",
    previousSha: "41329bd",
    currentSha: "5d0431d",
    changedFiles: ["apps/web/src/app/page.tsx"],
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.message, /Railway/);
});

test("CLI hook exits 0 for duplicate UI project without relying on git history", () => {
  const code = run({
    VERCEL_PROJECT_NAME: "rakshex-ui",
    VERCEL_GIT_PREVIOUS_SHA: "41329bdfb6f6008b07fe6c6fa3379014f8fc189d",
    VERCEL_GIT_COMMIT_SHA: "5d0431d5a3eeb05c75c13eee622e46980d3e2105",
  });
  assert.equal(code, 0);
});

test("proceeds when git diff is unavailable (shallow clone)", () => {
  const result = evaluateVercelShouldBuild({
    projectName: "rakshex",
    previousSha: "41329bd",
    currentSha: "5d0431d",
    gitDiffFailed: true,
  });
  assert.equal(result.exitCode, 1);
});
