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
      if (["node_modules", ".next", "dist", "scratch", "test"].includes(entry.name)) return [];
      return sourceFiles(target);
    }
    if (!/\.(ts|tsx|js|jsx|json|svg)$/.test(entry.name) || /\.test\./.test(entry.name)) return [];
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
    ];
    const forbidden = [
      /DevPulse/i,
      /devpulse\.ai/i,
      /\b4 patents?\b/i,
      /\bIndia(?:'|’)?s first\b/i,
      /\bworld[- ]first\b/i,
      /\binternal benchmarks?\b/i,
      /\bindependent audit Q3 2026\b/i,
      /\b12\.8K\b/i,
      /\b94\.2K\b/i,
      /\b295K\b/i,
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
