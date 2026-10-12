import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const code = run({
    VERCEL_PROJECT_NAME: "rakshex-ui",
    VERCEL_GIT_PREVIOUS_SHA: "41329bdfb6f6008b07fe6c6fa3379014f8fc189d",
    VERCEL_GIT_COMMIT_SHA: "5d0431d5a3eeb05c75c13eee622e46980d3e2105",
  });
  assert.equal(code, 0);
});

test("skips web deploy when diff is CLI-only", () => {
  const code = run({
    VERCEL_PROJECT_NAME: "rakshex",
    VERCEL_GIT_PREVIOUS_SHA: "41329bdfb6f6008b07fe6c6fa3379014f8fc189d",
    VERCEL_GIT_COMMIT_SHA: "5d0431d5a3eeb05c75c13eee622e46980d3e2105",
  });
  assert.equal(code, 0);
});

test("proceeds when apps/web changes", () => {
  const code = run({
    VERCEL_PROJECT_NAME: "rakshex",
    VERCEL_GIT_PREVIOUS_SHA: "e523ecdd6bac50ff1f517b496b8e7f2a26693a4b",
    VERCEL_GIT_COMMIT_SHA: "e61014f9aeb25e89358c83f843c0e5cd8a8fe507",
  });
  assert.equal(code, 1);
});

test("skips legacy *-api Vercel project", () => {
  const code = run({
    VERCEL_PROJECT_NAME: "rakshex-complete-codebase-api",
    VERCEL_GIT_COMMIT_SHA: "5d0431d",
    VERCEL_GIT_PREVIOUS_SHA: "41329bd",
  });
  assert.equal(code, 0);
});
