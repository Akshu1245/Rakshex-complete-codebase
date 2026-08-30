import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collect(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return [target];
  });
}

describe("private-beta sales lock on public legal surfaces", () => {
  const surfaces = [
    ...collect(path.join(webDir, "app/terms")),
    ...collect(path.join(webDir, "app/cookies")),
    ...collect(path.join(webDir, "app/privacy")),
    ...collect(path.join(webDir, "app/legal")),
    ...collect(path.join(webDir, "app/dpa")),
    ...collect(path.join(webDir, "app/faq")),
    ...collect(path.join(webDir, "content/legal")),
    path.join(webDir, "lib/legalPack.ts"),
  ];

  it("does not claim live checkout, auto-renewal, or self-serve purchases", () => {
    const forbidden = [
      /Paid plans renew until cancelled/i,
      /shown at checkout/i,
      /appear at checkout/i,
      /governs self-serve purchases/i,
      /Self-serve subscriptions renew/i,
      /charge recurring fees/i,
      /14-day free trial/i,
    ];
    const violations: string[] = [];
    for (const file of surfaces) {
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

  it("states waitlist/evaluation/invite access on terms and the refund pack", () => {
    const terms = fs.readFileSync(path.join(webDir, "app/terms/page.tsx"), "utf8");
    const refund = fs.readFileSync(
      path.join(webDir, "content/legal/REFUND_CANCELLATION_POLICY.md"),
      "utf8",
    );
    expect(terms).toMatch(/waitlist/);
    expect(terms).toMatch(/invite/);
    expect(terms).toMatch(/rakshex@gmail\.com/);
    expect(terms).toMatch(/Bengaluru/);
    expect(terms).toMatch(/laws of India/);
    expect(refund).toMatch(/waitlist/);
    expect(refund).toMatch(/invite or an executed Order Form/);
    expect(refund).toMatch(/rakshex@gmail\.com/);
    expect(refund).not.toMatch(/Subscriptions renew for the same period until cancelled/);
  });

  it("does not publish or link Terms/Refund Word files that still contain self-serve checkout", () => {
    const withdrawn = [
      "rakshex-terms-of-service.docx",
      "rakshex-refund-cancellation-policy.docx",
    ];
    const publicLegal = path.join(webDir, "public/legal");
    for (const name of withdrawn) {
      expect(fs.existsSync(path.join(publicLegal, name)), name).toBe(false);
    }

    const hrefPattern =
      /(?:href|download)\s*[:=]\s*["'`][^"'`]*rakshex-(?:terms-of-service|refund-cancellation-policy)\.docx["'`]/i;
    const pageRoots = [
      path.join(webDir, "app"),
      path.join(webDir, "components"),
      path.join(webDir, "lib"),
    ];
    const violations: string[] = [];
    for (const root of pageRoots) {
      for (const file of collect(root)) {
        if (!/\.(ts|tsx)$/.test(file)) continue;
        const source = fs.readFileSync(file, "utf8");
        if (hrefPattern.test(source)) {
          violations.push(path.relative(webDir, file));
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
