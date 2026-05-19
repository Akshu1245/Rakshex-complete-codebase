#!/usr/bin/env node
/**
 * Post-build script: adds .js extensions to all relative ESM imports/exports
 * in compiled dist/ files so they resolve under Node.js native ESM.
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

function rewrite(content) {
  // Match import/export specifiers that are relative and lack an extension
  // Handles: import x from "./foo"; export { x } from "../bar";
  const re = /((?:import|export)\s+(?:[^"']*\s+from\s+)?["'])(\.\/[^"']+|\.\.\/[^"']+)(["'])/g;
  return content.replace(re, (_match, prefix, specifier, suffix) => {
    // Skip if already has an extension or is a directory index
    if (/\.[a-z0-9]+$/i.test(specifier)) return _match;
    return `${prefix}${specifier}.js${suffix}`;
  });
}

let changed = 0;
for (const filePath of walk(DIST)) {
  const original = fs.readFileSync(filePath, "utf-8");
  const updated = rewrite(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, "utf-8");
    changed++;
  }
}

console.log(`[add-js-extensions] Rewrote ${changed} file(s) in ${DIST}`);
