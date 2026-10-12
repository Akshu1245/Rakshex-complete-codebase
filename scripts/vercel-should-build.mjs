#!/usr/bin/env node
/**
 * Vercel Ignored Build Step hook (see vercel.json ignoreCommand).
 * Exit 0 = cancel deployment; exit 1 = proceed with build.
 *
 * The Express API runs on Railway/Docker, not Vercel. A legacy Vercel project
 * named *-api is still linked to this repo and would fail every Next.js build.
 *
 * Web builds also skip when the commit diff does not touch frontend inputs, so
 * CLI/API-only merges do not consume Vercel build quota on duplicate projects.
 */
import { execSync } from "node:child_process";

const projectName = process.env.VERCEL_PROJECT_NAME ?? "";

/** Vercel projects that should not build from this monorepo. */
const SKIP_PROJECT = /(?:^|-)api$/i.test(projectName) || /complete-codebase-api/i.test(projectName);

/** Legacy duplicate frontend project (Root Directory apps/web). Canonical web deploy is repo-root rakshex. */
const SKIP_DUPLICATE_UI = /^rakshex-ui$/i.test(projectName);

/** Paths that affect @rakshex/web production output or Vercel build hooks. */
const WEB_BUILD_PATH =
  /^(apps\/web\/|packages\/|scripts\/vercel|pnpm-lock\.yaml$|package\.json$|vercel\.json$|apps\/web\/vercel\.json$)/;

function webInputsChanged() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!previous || !current || previous === current) {
    return true;
  }
  try {
    const diff = execSync(`git diff --name-only ${previous} ${current}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const files = diff
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (files.length === 0) {
      return false;
    }
    return files.some((file) => WEB_BUILD_PATH.test(file));
  } catch {
    return true;
  }
}

if (SKIP_PROJECT) {
  console.log(
    `[vercel-should-build] Skipping "${projectName}" — API is deployed via Railway/Docker (see docs/DEPLOY_RAILWAY_VERCEL.md).`,
  );
  process.exit(0);
}

if (SKIP_DUPLICATE_UI) {
  console.log(
    `[vercel-should-build] Skipping "${projectName}" — canonical Next.js deploy is repo-root "rakshex" (see docs/DEPLOY_RAILWAY_VERCEL.md).`,
  );
  process.exit(0);
}

if (!webInputsChanged()) {
  console.log(
    `[vercel-should-build] Skipping "${projectName || "unknown"}" — no web-relevant files changed since ${process.env.VERCEL_GIT_PREVIOUS_SHA?.slice(0, 7) ?? "previous"}.`,
  );
  process.exit(0);
}

console.log(`[vercel-should-build] Proceeding with web build for "${projectName || "unknown"}".`);
process.exit(1);
