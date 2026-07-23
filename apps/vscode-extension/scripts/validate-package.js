#!/usr/bin/env node
/**
 * Pre-publish validation for the Rakshex VS Code extension.
 * Run before `vsce publish` (also wired via `npm run package`).
 */
const fs = require("fs");
const path = require("path");

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

const root = path.join(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const readmePath = path.join(root, "MARKETPLACE_README.md");
const changelogPath = path.join(root, "CHANGELOG.md");
const iconPngPath = path.join(root, "resources", "icon.png");
const iconSvgPath = path.join(root, "resources", "icon.svg");

if (!fs.existsSync(pkgPath)) {
  fail("package.json not found");
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

const requiredFields = [
  "name",
  "version",
  "publisher",
  "engines",
  "categories",
  "activationEvents",
  "contributes",
];
for (const field of requiredFields) {
  if (!pkg[field]) fail(`package.json missing required field: ${field}`);
}

if (pkg.name !== "rakshex-vscode") {
  fail(`package.json name must be "rakshex-vscode" (got "${pkg.name}")`);
}
if (pkg.publisher !== "rakshex") {
  warn(`Expected publisher "rakshex" (got "${pkg.publisher}")`);
}
if (!pkg.engines?.vscode) fail("package.json missing engines.vscode");
if (!pkg.categories?.includes("Other")) warn('package.json categories should include "Other"');
if (!pkg.keywords?.length) warn("package.json should include keywords for discoverability");
if (!pkg.repository?.url) warn("package.json should include repository URL");
if (!pkg.bugs?.url) warn("package.json should include bugs URL");
if (!pkg.homepage) warn("package.json should include homepage");
if (!pkg.license) warn("package.json should include license");
if (!pkg.icon) warn("package.json should include icon path");
if (pkg.version === "0.0.1") warn("Version is still 0.0.1 — bump before publish");

if (
  pkg.scripts?.["vscode:prepublish"] &&
  !String(pkg.scripts["vscode:prepublish"]).includes("esbuild")
) {
  warn("vscode:prepublish should run esbuild minify (npm run esbuild-base -- --minify)");
}
if (
  pkg.scripts?.build &&
  String(pkg.scripts.build).includes("tsc") &&
  !String(pkg.scripts.build).includes("esbuild")
) {
  warn("build should use esbuild (not tsc writing dist)");
}

// --- MARKETPLACE_README validation ---
if (!fs.existsSync(readmePath)) {
  fail("MARKETPLACE_README.md not found");
} else {
  const readme = fs.readFileSync(readmePath, "utf-8");
  if (readme.length < 500) warn("MARKETPLACE_README is very short — add more detail");
  if (!readme.includes("## Install")) warn("MARKETPLACE_README missing ## Install section");
  if (!readme.includes("## Features")) warn("MARKETPLACE_README missing ## Features section");
  if (!readme.includes("## Pricing")) warn("MARKETPLACE_README missing ## Pricing section");
  if (!readme.includes("rakshex.in")) warn("MARKETPLACE_README missing link to rakshex.in");
  if (!readme.includes("rakshex.rakshex-vscode")) {
    warn("MARKETPLACE_README should reference marketplace ID rakshex.rakshex-vscode");
  }
}

// --- CHANGELOG validation ---
if (!fs.existsSync(changelogPath)) {
  warn("CHANGELOG.md not found — create one");
}

// --- Icon validation (Marketplace requires PNG) ---
if (!fs.existsSync(iconPngPath)) {
  fail("Extension icon not found at resources/icon.png");
} else if (pkg.icon && !String(pkg.icon).endsWith("icon.png")) {
  warn("package.json icon should point to resources/icon.png");
}
if (!fs.existsSync(iconSvgPath)) {
  warn("Optional activity-bar icon missing at resources/icon.svg");
}

// --- Build artifacts (esbuild output) ---
const distDir = path.join(root, "dist");
if (!fs.existsSync(distDir)) {
  fail("dist/ directory not found — run npm run build (esbuild) first");
} else {
  const extensionJs = path.join(distDir, "extension.js");
  if (!fs.existsSync(extensionJs))
    fail("dist/extension.js not found — run npm run build / vscode:prepublish");
}

// --- Output ---
console.log("=== Rakshex Extension Validation ===\n");
console.log(`   Extension ID: ${pkg.publisher}.${pkg.name}`);
console.log(`   Version: ${pkg.version}\n`);

if (warnings.length) {
  console.log(`⚠️  ${warnings.length} Warning${warnings.length > 1 ? "s" : ""}:`);
  warnings.forEach((w) => console.log(`  - ${w}`));
  console.log("");
}

if (errors.length) {
  console.log(`❌ ${errors.length} Error${errors.length > 1 ? "s" : ""}:`);
  errors.forEach((e) => console.log(`  - ${e}`));
  console.log("\n🔴 Publish blocked. Fix errors above.");
  process.exit(1);
} else {
  console.log("✅ All checks passed. Ready to publish.");
  console.log(`   Version: ${pkg.version}`);
  console.log(`   Publisher: ${pkg.publisher}`);
  console.log("\nNext step: vsce publish  (or npm run package)");
}
