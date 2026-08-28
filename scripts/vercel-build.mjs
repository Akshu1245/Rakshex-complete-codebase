import fs from "fs";
import { execSync } from "child_process";

console.log("==> Starting Rakshex Web Build...");

// Patch async-local-storage.js in Next.js before & after build to use node:async_hooks fallback
function patchAsyncLocalStorage(filePath) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");
    if (
      content.includes(
        "const maybeGlobalAsyncLocalStorage = typeof globalThis !== 'undefined' && globalThis.AsyncLocalStorage;",
      )
    ) {
      content = content.replace(
        "const maybeGlobalAsyncLocalStorage = typeof globalThis !== 'undefined' && globalThis.AsyncLocalStorage;",
        "const maybeGlobalAsyncLocalStorage = (typeof globalThis !== 'undefined' && globalThis.AsyncLocalStorage) || require('node:async_hooks').AsyncLocalStorage;",
      );
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Successfully patched AsyncLocalStorage in ${filePath}`);
    }
  }
}

const targetPaths = [
  "node_modules/next/dist/server/app-render/async-local-storage.js",
  "apps/web/node_modules/next/dist/server/app-render/async-local-storage.js",
];

targetPaths.forEach(patchAsyncLocalStorage);

// Run Next.js web build
execSync("pnpm --filter @rakshex/web build", { stdio: "inherit" });

// Patch again after build
targetPaths.forEach(patchAsyncLocalStorage);

// Create stubs for Vercel adapter tracing
const stubPaths = [
  "node_modules/next/dist/build/adapter/setup-node-env.external.js",
  "apps/web/node_modules/next/dist/build/adapter/setup-node-env.external.js",
];

for (const stubPath of stubPaths) {
  try {
    const dir = stubPath.substring(0, stubPath.lastIndexOf("/"));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stubPath, "module.exports = {};");
  } catch (err) {}
}

// Sync built outputs to web/.next for Vercel multi-service monorepo tracer
console.log("==> Syncing outputs to web/.next...");
fs.mkdirSync("web", { recursive: true });
fs.cpSync("apps/web/.next", "web/.next", { recursive: true });
fs.copyFileSync("apps/web/package.json", "web/.next/package.json");
console.log("==> Build and sync complete!");
