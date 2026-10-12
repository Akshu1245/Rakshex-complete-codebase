import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

/**
 * vercel-build.mjs historically wrote adapter stubs under
 * apps/web/node_modules/next/dist/... which mkdirSync'd a partial "next"
 * package. With pnpm hoisted layout, that shadow directory breaks OG image
 * prerender (missing @vercel/og compiled assets).
 */
export function cleanupPartialNextShadow(repoRoot = process.cwd()) {
  const shadowNext = path.join(repoRoot, "apps/web/node_modules/next");
  const pkgJson = path.join(shadowNext, "package.json");
  if (fs.existsSync(shadowNext) && !fs.existsSync(pkgJson)) {
    fs.rmSync(shadowNext, { recursive: true, force: true });
    console.log(`[vercel-cleanup] Removed partial next shadow at ${shadowNext}`);
  }
}

/** Point apps/web at the hoisted next package so Vercel's app tracer resolves next. */
export function ensureAppsWebNextSymlink(repoRoot = process.cwd()) {
  cleanupPartialNextShadow(repoRoot);

  const linkPath = path.join(repoRoot, "apps/web/node_modules/next");
  const hoistedNext = path.join(repoRoot, "node_modules/next");
  const hoistedPkg = path.join(hoistedNext, "package.json");
  if (!fs.existsSync(hoistedPkg)) {
    return;
  }

  if (fs.existsSync(linkPath)) {
    if (fs.existsSync(path.join(linkPath, "package.json"))) {
      return;
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  const relativeTarget = path.relative(path.dirname(linkPath), hoistedNext);
  fs.symlinkSync(relativeTarget, linkPath, "dir");
  console.log(
    `[vercel-cleanup] Linked apps/web/node_modules/next -> ${relativeTarget}`,
  );
}

const ADAPTER_STUB = "module.exports = {};";
const ADAPTER_STUB_REL = "dist/build/adapter/setup-node-env.external.js";

/** Stub Next adapter env module on real next install roots (never a partial shadow tree). */
export function writeVercelAdapterStub(repoRoot = process.cwd()) {
  ensureAppsWebNextSymlink(repoRoot);

  const nextRoots = new Set();
  for (const pkgJson of [
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "apps/web/package.json"),
  ]) {
    if (!fs.existsSync(pkgJson)) continue;
    try {
      const req = createRequire(pkgJson);
      nextRoots.add(path.dirname(req.resolve("next/package.json")));
    } catch {
      // next not resolvable from this package root
    }
  }

  for (const nextRoot of nextRoots) {
    const stubPath = path.join(nextRoot, ADAPTER_STUB_REL);
    fs.mkdirSync(path.dirname(stubPath), { recursive: true });
    fs.writeFileSync(stubPath, ADAPTER_STUB);
    console.log(`[vercel-build] Wrote adapter stub at ${stubPath}`);
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  // Invoked from apps/web (Vercel Root Directory); cwd is apps/web.
  const repoRoot = path.resolve(process.cwd(), "../..");
  cleanupPartialNextShadow(repoRoot);
  ensureAppsWebNextSymlink(repoRoot);
}
