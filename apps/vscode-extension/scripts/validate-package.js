#!/usr/bin/env node
/**
 * Pre-publish validation script for DevPulse VS Code extension.
 * Run before `vsce publish` to catch issues early.
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

const pkgPath = path.join(__dirname, "..", "package.json");
const readmePath = path.join(__dirname, "..", "MARKETPLACE_README.md");
const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
const iconPath = path.join(__dirname, "..", "resources", "icon.svg");

// --- package.json validation ---
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

if (!pkg.engines?.vscode) fail("package.json missing engines.vscode");
if (!pkg.categories?.includes("Other")) warn('package.json categories should include "Other"');
if (!pkg.keywords?.length) warn("package.json should include keywords for discoverability");
if (!pkg.repository?.url) warn("package.json should include repository URL");
if (!pkg.bugs?.url) warn("package.json should include bugs URL");
if (!pkg.homepage) warn("package.json should include homepage");
if (!pkg.license) warn("package.json should include license");
if (!pkg.icon) warn("package.json should include icon path");
if (pkg.version === "0.0.1") warn("Version is still 0.0.1 — bump before publish");

// --- README validation ---
if (!fs.existsSync(readmePath)) {
  fail("MARKETPLACE_README.md not found");
} else {
  const readme = fs.readFileSync(readmePath, "utf-8");
  if (readme.length < 500) warn("README is very short — add more detail");
  if (!readme.includes("## Install")) warn("README missing ## Install section");
  if (!readme.includes("## Features")) warn("README missing ## Features section");
  if (!readme.includes("## Pricing")) warn("README missing ## Pricing section");
  if (!readme.includes("devpulse.in")) warn("README missing link to devpulse.in");
}

// --- CHANGELOG validation ---
if (!fs.existsSync(changelogPath)) {
  warn("CHANGELOG.md not found — create one");
}

// --- Icon validation ---
if (!fs.existsSync(iconPath)) {
  warn("Extension icon not found at resources/icon.svg");
}

// --- Build artifacts ---
const distDir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
  fail("dist/ directory not found — run npm run compile first");
} else {
  const extensionJs = path.join(distDir, "extension.js");
  if (!fs.existsSync(extensionJs)) fail("dist/extension.js not found — compilation failed?");
}

// --- Output ---
console.log("=== DevPulse Extension Validation ===\n");

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
  console.log("\nNext step: vsce publish");
}
