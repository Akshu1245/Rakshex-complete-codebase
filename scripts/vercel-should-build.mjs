#!/usr/bin/env node
/**
 * Vercel Ignored Build Step hook (see vercel.json ignoreCommand).
 * Exit 0 = cancel deployment; exit 1 = proceed with build.
 *
 * The Express API runs on Railway/Docker, not Vercel. A legacy Vercel project
 * named *-api is still linked to this repo and would fail every Next.js build.
 */
const projectName = process.env.VERCEL_PROJECT_NAME ?? "";

/** Vercel projects that should not build from this monorepo. */
const SKIP_PROJECT = /(?:^|-)api$/i.test(projectName) || /complete-codebase-api/i.test(projectName);

if (SKIP_PROJECT) {
  console.log(
    `[vercel-should-build] Skipping "${projectName}" — API is deployed via Railway/Docker (see docs/DEPLOY_RAILWAY_VERCEL.md).`,
  );
  process.exit(0);
}

console.log(`[vercel-should-build] Proceeding with web build for "${projectName || "unknown"}".`);
process.exit(1);
