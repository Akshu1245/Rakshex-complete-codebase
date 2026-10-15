import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeApiImpact } from "./apiImpact.js";
import { changedProperty, normalizeConsumerImpact } from "./consumerImpact.js";
import { parseSpecLimit, HARD_MAX_SPEC_MIB } from "./apiDiff.js";

const bench = join(__dirname, "..", "bench", "self-repair");
const subset = (pair: string) => JSON.parse(readFileSync(join(bench, "fixtures", pair + ".subset.json"), "utf8")).changes;

describe("consumer-impact normalizer", () => {
  it("extracts the changed request property from oasdiff text", () => {
    expect(changedProperty("removed the request property `payment_method_types`")).toBe("payment_method_types");
    expect(changedProperty("the `a/b` request property `type` changed from `any` to `object`")).toBe("a/b");
    expect(changedProperty("removed the enum value `now` of the request property `billing_cycle_anchor`")).toBe("billing_cycle_anchor");
  });

  it("acceptance fixture: raw HTTP site breaks, semantic warning kept, unrelated file ignored, noise suppressed", () => {
    const changes = subset("stripe-v2516-v2517");
    const rep = analyzeApiImpact(join(bench, "repos", "endive-acceptance"), changes, { hosts: ["api.stripe.com"] });
    const ci = normalizeConsumerImpact(changes, rep.sites);
    const breaks = ci.impacts.filter((i) => i.verdict === "breaks_call");
    expect(breaks.map((b) => b.site.file + ":" + b.site.line)).toContain("src/billing/raw.ts:4");
    expect(breaks[0]!.semanticWarning?.source).toContain("docs.stripe.com");
    expect(breaks[0]!.evidence.matchedKeys).toEqual(["payment_method_types"]);
    expect(ci.impacts.some((i) => i.site.file.includes("unrelated"))).toBe(false);
    expect(ci.suppressedNotCalled).toBeGreaterThan(0);
  });

  it("nested new-required property applies only when its parent object is sent", () => {
    const changes = subset("stripe-v2203-v2204");
    const rep = analyzeApiImpact(join(bench, "repos", "dahlia-issuing"), changes, { hosts: ["api.stripe.com"] });
    const ci = normalizeConsumerImpact(changes, rep.sites);
    const props = ci.impacts.filter((i) => i.verdict === "breaks_call").map((i) => i.change.property).sort();
    expect(props).toEqual([
      "risk_assessment/card_testing_risk/level",
      "risk_assessment/card_testing_risk/risk_level",
      "risk_assessment/merchant_dispute_risk/level",
      "risk_assessment/merchant_dispute_risk/risk_level",
    ]);
    // the SDK call without risk_assessment (line 6) is not affected by the nested requirement
    expect(ci.impacts.some((i) => i.site.line === 6 && i.verdict !== "response_review")).toBe(false);
  });

  it("does not attribute the same path on a foreign host", () => {
    const rep = analyzeApiImpact(join(bench, "repos", "endive-patterns"), subset("stripe-v2516-v2517"), { hosts: ["api.stripe.com"] });
    const other = rep.sites.find((s) => s.host === "api.example.com");
    expect(other?.reason).toMatch(/host/);
    expect(rep.matches.some((m) => m.file === "src/billing/flows.ts" && m.line === 24)).toBe(false);
  });

  it("an unresolved payload is reported as unresolved, never as not-affected", () => {
    const ci = normalizeConsumerImpact(
      [{ id: "request-property-removed", operation: "POST", path: "/v1/x", text: "removed the request property `p`" }],
      [{ file: "a.ts", line: 1, column: 1, call: "fetch", method: "POST", path: "/v1/x", host: null, payload: { status: "unknown", keys: [], values: {}, unresolved: ["body: input"], via: [] } }],
    );
    expect(ci.impacts).toHaveLength(1);
    expect(ci.impacts[0]!.verdict).toBe("unresolved");
  });
});

describe("bounded spec ingestion", () => {
  it("keeps the 5 MiB default and enforces a hard ceiling", () => {
    expect(parseSpecLimit(undefined)).toBe(5);
    expect(parseSpecLimit("16")).toBe(16);
    expect(() => parseSpecLimit(String(HARD_MAX_SPEC_MIB + 1))).toThrow(/max-spec-mib/);
    expect(() => parseSpecLimit("0")).toThrow();
    expect(() => parseSpecLimit("1e9")).toThrow();
  });
});
