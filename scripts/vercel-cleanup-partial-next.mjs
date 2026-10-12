import fs from "fs";
import path from "path";

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

import { fileURLToPath } from "url";

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  // Invoked from apps/web (Vercel Root Directory); cwd is apps/web.
  cleanupPartialNextShadow(path.resolve(process.cwd(), "../.."));
}
