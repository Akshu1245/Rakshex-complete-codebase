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
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Paths that affect @rakshex/web production output or Vercel build hooks. */
export const WEB_BUILD_PATH =
  /^(apps\/web\/|packages\/|scripts\/vercel|pnpm-lock\.yaml$|package\.json$|vercel\.json$|apps\/web\/vercel\.json$)/;

export function webInputsChangedFromFiles(files) {
  if (files.length === 0) {
    return false;
  }
  return files.some((file) => WEB_BUILD_PATH.test(file));
}

export function listGitChangedFiles(previous, current) {
  const diff = execSync(`git diff --name-only ${previous} ${current}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return diff
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * @param {{
 *   projectName?: string;
 *   previousSha?: string;
 *   currentSha?: string;
 *   changedFiles?: string[] | null;
 *   gitDiffFailed?: boolean;
 * }} input
 * @returns {{ exitCode: 0 | 1; message: string }}
 */
export function evaluateVercelShouldBuild(input) {
  const projectName = input.projectName ?? "";
  const previousSha = input.previousSha;
  const currentSha = input.currentSha;

  const skipProject =
    /(?:^|-)api$/i.test(projectName) || /complete-codebase-api/i.test(projectName);
  if (skipProject) {
    return {
      exitCode: 0,
      message: `[vercel-should-build] Skipping "${projectName}" — API is deployed via Railway/Docker (see docs/DEPLOY_RAILWAY_VERCEL.md).`,
    };
  }

  const skipDuplicateUi = /^rakshex-ui$/i.test(projectName);
  if (skipDuplicateUi) {
    return {
      exitCode: 0,
      message: `[vercel-should-build] Skipping "${projectName}" — canonical Next.js deploy is repo-root "rakshex" (see docs/DEPLOY_RAILWAY_VERCEL.md).`,
    };
  }

  const missingSha = !previousSha || !currentSha || previousSha === currentSha;
  if (missingSha) {
    return {
      exitCode: 1,
      message: `[vercel-should-build] Proceeding with web build for "${projectName || "unknown"}".`,
    };
  }

  if (input.gitDiffFailed) {
    return {
      exitCode: 1,
      message: `[vercel-should-build] Proceeding with web build for "${projectName || "unknown"}".`,
    };
  }

  const files = input.changedFiles ?? [];
  if (!webInputsChangedFromFiles(files)) {
    return {
      exitCode: 0,
      message: `[vercel-should-build] Skipping "${projectName || "unknown"}" — no web-relevant files changed since ${previousSha.slice(0, 7)}.`,
    };
  }

  return {
    exitCode: 1,
    message: `[vercel-should-build] Proceeding with web build for "${projectName || "unknown"}".`,
  };
}

function resolveChangedFiles(previousSha, currentSha) {
  try {
    return { changedFiles: listGitChangedFiles(previousSha, currentSha), gitDiffFailed: false };
  } catch {
    return { changedFiles: null, gitDiffFailed: true };
  }
}

function runCli() {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const { changedFiles, gitDiffFailed } =
    previousSha && currentSha && previousSha !== currentSha
      ? resolveChangedFiles(previousSha, currentSha)
      : { changedFiles: null, gitDiffFailed: false };

  const result = evaluateVercelShouldBuild({
    projectName: process.env.VERCEL_PROJECT_NAME ?? "",
    previousSha,
    currentSha,
    changedFiles: changedFiles ?? undefined,
    gitDiffFailed,
  });
  console.log(result.message);
  process.exit(result.exitCode);
}

const isDirectRun =
  process.argv[1] &&
  path.normalize(path.resolve(process.argv[1])) === path.normalize(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runCli();
}
