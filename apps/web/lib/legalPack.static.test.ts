import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collect(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return [target];
  });
}

describe("baked legal pack", () => {
  it("keeps document bodies in local markdown, not an API fetch", () => {
    const files = [
      ...collect(path.join(webDir, "app/legal")),
      ...collect(path.join(webDir, "app/dpa")),
      path.join(webDir, "lib/legalPack.ts"),
      path.join(webDir, "lib/legalMarkdown.ts"),
      path.join(webDir, "components/legal/LegalDocumentPage.tsx"),
    ];
    const forbidden = [
      /api\.rakshex\.in/i,
      /\bfetch\s*\(/,
      /\btrpc\b/,
      /useQuery/,
      /Loading\.\.\./,
    ];
    const violations: string[] = [];
    for (const file of files) {
      if (!fs.statSync(file).isFile()) continue;
      if (!/\.(ts|tsx|md)$/.test(file)) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(source)) {
          violations.push(`${path.relative(webDir, file)} matched ${pattern}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("ships the July 2026 DPA and subprocessor markdown", () => {
    const dpa = fs.readFileSync(
      path.join(webDir, "content/legal/DATA_PROCESSING_ADDENDUM.md"),
      "utf8",
    );
    const subprocessors = fs.readFileSync(
      path.join(webDir, "content/legal/SUBPROCESSOR_REGISTER.md"),
      "utf8",
    );
    expect(dpa).toMatch(/Effective date:\s*12 July 2026/);
    expect(dpa).toMatch(/privacy@rakshex\.in/);
    expect(dpa).toMatch(/security@rakshex\.in/);
    expect(subprocessors).toMatch(/privacy@rakshex\.in/);
    expect(dpa).not.toMatch(/security@rakshex\.com/);
    const refund = fs.readFileSync(
      path.join(webDir, "content/legal/REFUND_CANCELLATION_POLICY.md"),
      "utf8",
    );
    expect(refund).toMatch(/Effective date:\s*12 July 2026/);
    expect(refund).toMatch(/There is no live checkout, tax or GST collection/);
    expect(refund).not.toMatch(/cannot take money this week/);
    expect(refund).not.toMatch(/shown at checkout/);
    expect(fs.existsSync(path.join(webDir, "public/legal/rakshex-terms-of-service.docx"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(webDir, "public/legal/rakshex-refund-cancellation-policy.docx")),
    ).toBe(false);
  });
});
