#!/usr/bin/env node
/**
 * Post-build script: rewrites compiled dist/ JS so imports resolve under Node.js native ESM.
 * 1. Adds .js to bare relative imports (./foo → ./foo.js)
 * 2. Rewrites @shared/* path aliases to relative paths (../../shared/const.js)
 *
 * Run after: tsc
 */
import fs from "fs";
import path from "path";

const DIST = path.resolve(process.cwd(), "dist");

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      yield full;
    }
  }
}

function rewrite(content, filePath) {
  const fileDir = path.dirname(filePath);

  // 1. Rewrite @shared/* aliases to relative paths
  //    e.g. @shared/const → ../../shared/const.js (from dist/server/_core/oauth.js)
  const aliasRe = /((?:import|export)\s+(?:[^"']*\s+from\s+)?["'])(@shared\/[^"']+)(["'])/g;
  content = content.replace(aliasRe, (_match, prefix, specifier, suffix) => {
    // @shared/const  →  dist/shared/const
    const sharedTarget = path.join(DIST, specifier.replace(/^@/, ""));
    let rel = path.relative(fileDir, sharedTarget).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    if (!/\.[a-z0-9]+$/i.test(rel)) rel += ".js";
    return `${prefix}${rel}${suffix}`;
  });

  // 2. Add .js to bare relative imports that still lack an extension
  //    Skip if already has an extension
  const relRe = /((?:import|export)\s+(?:[^"']*\s+from\s+)?["'])(\.\.?(\/[^"']*)?)(["'])/g;
  content = content.replace(relRe, (_match, prefix, specifier, _sub, suffix) => {
    if (/\.(?:js|json|mjs|cjs)$/i.test(specifier)) return _match;

    const targetPath = path.resolve(fileDir, specifier);

    // Prioritize file matches (e.g. someName.js) over directory index matches (someName/index.js)
    // because TypeScript/Node.js prioritize files over directories of the same name.
    let foundFileExt = "";
    for (const ext of [".js", ".json", ".mjs", ".cjs"]) {
      if (fs.existsSync(targetPath + ext)) {
        foundFileExt = ext;
        break;
      }
    }
    if (foundFileExt) {
      return `${prefix}${specifier}${foundFileExt}${suffix}`;
    }

    // Check if the relative path resolves to a directory
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      const cleanSpecifier = specifier.endsWith("/") ? specifier.slice(0, -1) : specifier;
      return `${prefix}${cleanSpecifier}/index.js${suffix}`;
    }

    return `${prefix}${specifier}.js${suffix}`;
  });

  // 3. Rewrite dynamic imports (await import("../foo") → await import("../foo.js"))
  const dynRe = /(import\s*\(\s*["'])(\.\.?(\/[^"']*)?)(["']\s*\))/g;
  content = content.replace(dynRe, (_match, prefix, specifier, _sub, suffix) => {
    if (/\.(?:js|json|mjs|cjs)$/i.test(specifier)) return _match;

    const targetPath = path.resolve(fileDir, specifier);
    let foundFileExt = "";
    for (const ext of [".js", ".json", ".mjs", ".cjs"]) {
      if (fs.existsSync(targetPath + ext)) {
        foundFileExt = ext;
        break;
      }
    }
    if (foundFileExt) {
      return `${prefix}${specifier}${foundFileExt}${suffix}`;
    }
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      const cleanSpecifier = specifier.endsWith("/") ? specifier.slice(0, -1) : specifier;
      return `${prefix}${cleanSpecifier}/index.js${suffix}`;
    }
    return `${prefix}${specifier}.js${suffix}`;
  });

  return content;
}

let changed = 0;
for (const filePath of walk(DIST)) {
  const original = fs.readFileSync(filePath, "utf-8");
  const updated = rewrite(original, filePath);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, "utf-8");
    changed++;
  }
}

console.log(`[add-js-extensions] Rewrote ${changed} file(s) in ${DIST}`);
