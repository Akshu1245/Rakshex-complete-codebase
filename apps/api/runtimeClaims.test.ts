import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(apiDir, "../..");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // .vercel holds gitignored deploy artifacts (project.json carries the
      // old project slug); scanning them reports violations for files that
      // are never shipped and cannot be edited meaningfully.
      if (["node_modules", ".next", ".vercel", "dist", "scratch", "test"].includes(entry.name)) {
        return [];
      }
      return sourceFiles(target);
    }
    if (!/\.(ts|tsx|js|jsx|json|svg|md|txt)$/.test(entry.name) || /\.test\./.test(entry.name)) {
      return [];
    }
    return [target];
  });
}

describe("customer-facing trust claims", () => {
  it("does not reintroduce the retired brand or unsupported proof claims", () => {
    const files = [
      ...sourceFiles(path.join(repoRoot, "apps/web")),
      ...sourceFiles(path.join(repoRoot, "apps/vscode-extension/src")),
      path.join(repoRoot, "apps/vscode-extension/package.json"),
      path.join(repoRoot, "apps/api/email.ts"),
      path.join(repoRoot, "docs/SECURITY.md"),
      path.join(repoRoot, "apps/web/public/.well-known/security.txt"),
    ];
    const forbidden = [
      /RaksHex/i,
      /rakshex\.ai/i,
      /\b4 patents?\b/i,
      /\bIndia(?:'|’)?s first\b/i,
      /\bworld[- ]first\b/i,
      /\binternal benchmarks?\b/i,
      /\bindependent audit Q3 2026\b/i,
      /\b12\.8K\b/i,
      /\b94\.2K\b/i,
      /\b295K\b/i,
      /SOC 2 audit in progress/i,
      /SOC2 audit in progress/i,
      /SOC2 In Progress/,
      /One-click PDF/i,
      /1-Click SOC2/i,
      /SOC2, PCI DSS, OWASP/,
      /1000\+\s*server tests/i,
      /security@rakshex\.com/i,
    ];
    const violations: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(repoRoot, file)} matched ${pattern}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
