/**
 * Temporary, strictly version-checked upstream OpenNext bug workaround.
 * Next.js 16.4 unconditionally loads .next/server/preview-props.json.
 * OpenNext 1.20.10's manifest glob omits that file, so every SSR route 500s.
 * Mirrors the one-token fix proposed in upstream PR #1356:
 * https://github.com/opennextjs/opennextjs-cloudflare/pull/1356
 *
 * Runs against the installed build adapter only; never changes upstream source
 * in Git or in the production Worker. Remove once the released adapter has the fix.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// pnpm may store workspace dev dependencies in the root virtual store rather
// than linking them into apps/web/node_modules when a CI runner uses NODE_ENV.
const repoRoot = path.resolve(here, "../..");
const candidates = [
  path.join(repoRoot, "apps/web/node_modules/@opennextjs/cloudflare"),
  path.join(repoRoot, "node_modules/@opennextjs/cloudflare"),
];
const virtualStore = path.join(repoRoot, "node_modules/.pnpm");
if (fs.existsSync(virtualStore)) {
  for (const name of fs.readdirSync(virtualStore)) {
    if (name.startsWith("@opennextjs+cloudflare@1.20.10")) {
      candidates.push(path.join(virtualStore, name, "node_modules/@opennextjs/cloudflare"));
    }
  }
}
const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
if (!found) {
  throw new Error("OpenNext 1.20.10 not installed; run pnpm install --prod=false");
}
const packagePath = path.join(found, "package.json");
const meta = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (meta.version !== "1.20.10") {
  throw new Error(
    `Refusing to patch unreviewed OpenNext version ${meta.version}; expected 1.20.10`,
  );
}

const root = fs.realpathSync(path.dirname(packagePath));
const before = "{*-manifest,required-server-files,prefetch-hints}.json";
const after = "{*-manifest,required-server-files,prefetch-hints,preview-props}.json";
let replacements = 0;
let alreadyFixed = 0;
const allowed = new Set([".js", ".mjs", ".cjs"]);

function walk(dir, depth = 0) {
  if (depth > 9) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, depth + 1);
      continue;
    }
    if (!entry.isFile() || !allowed.has(path.extname(full))) continue;
    if (fs.statSync(full).size > 16_000_000) continue;
    const data = fs.readFileSync(full, "utf8");
    if (data.includes(after)) {
      alreadyFixed++;
      continue;
    }
    if (!data.includes(before)) continue;
    const count = data.split(before).length - 1;
    if (count !== 1) throw new Error("Unexpected OpenNext manifest glob multiplicity");
    fs.writeFileSync(full, data.replace(before, after));
    replacements++;
    console.log("Applied preview-props manifest glob fix to " + path.relative(root, full));
  }
}
walk(root);

if (replacements !== 1 && !(replacements === 0 && alreadyFixed === 1)) {
  throw new Error(
    `OpenNext manifest patch not verified (patched=${replacements}, existing=${alreadyFixed}); refusing to build`,
  );
}
console.log("OpenNext 1.20.10 Next.js 16.4 manifest inclusion verified");
