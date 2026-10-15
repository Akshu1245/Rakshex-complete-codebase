import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { analyzeApiImpact } from "./apiImpact.js";
import { normalizeConsumerImpact } from "./consumerImpact.js";

const bench = join(__dirname, "..", "bench", "self-repair");
const changes = JSON.parse(readFileSync(join(bench, "fixtures", "stripe-v2516-v2517.subset.json"), "utf8")).changes;
const run = (dir: string) => {
  const rep = analyzeApiImpact(dir, changes, { hosts: ["api.stripe.com"] });
  return { rep, ci: normalizeConsumerImpact(changes, rep.sites) };
};
const breaks = (ci: ReturnType<typeof normalizeConsumerImpact>) =>
  ci.impacts.filter((i) => i.verdict === "breaks_call" || i.verdict === "possibly_breaks").map((i) => i.site.file + ":" + i.site.line).sort();

let root: string;
const src = (p: string, code: string) => { const f = join(root, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, code); };
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "rakshex-sdk-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("stripe-node SDK-aware impact", () => {
  it("acceptance fixture: all 3 call sites, unrelated 4th ignored, semantic warning kept, evidence attached", () => {
    const { ci } = run(join(bench, "repos", "endive-acceptance"));
    expect(breaks(ci)).toEqual(["src/billing/raw.ts:4", "src/payments/checkout.ts:4", "src/payments/intents.ts:5"]);
    expect(ci.impacts.some((i) => i.site.file.includes("unrelated"))).toBe(false);
    const checkout = ci.impacts.find((i) => i.site.file === "src/payments/checkout.ts" && i.verdict === "breaks_call")!;
    expect(checkout.site.sdkMethod).toBe("checkout.sessions.create");
    expect(checkout.semanticWarning?.note).toMatch(/silently filters/);
    expect(checkout.evidence.via.join(" ")).toMatch(/new Stripe\(\)/);
    const intents = ci.impacts.find((i) => i.site.file === "src/payments/intents.ts" && i.verdict === "breaks_call")!;
    expect(intents.evidence.via.join(" ")).toMatch(/const base/);
  });

  it("wrappers fan out to callers; callers that do not send the property are not flagged", () => {
    const { ci } = run(join(bench, "repos", "endive-patterns"));
    const b = breaks(ci);
    expect(b).toContain("src/billing/flows.ts:4");
    expect(b).not.toContain("src/billing/flows.ts:7");
    expect(b).not.toContain("src/billing/flows.ts:14");
    expect(b.some((x) => x.startsWith("src/decoys/"))).toBe(false);
    const viaWrapper = ci.impacts.find((i) => i.site.line === 4 && i.site.file === "src/billing/flows.ts")!;
    expect(viaWrapper.evidence.via.join(" ")).toMatch(/wrapper createSession/);
  });

  it("dynamic payloads and computed resources are UNKNOWN, never 'not affected'", () => {
    const { rep, ci } = run(join(bench, "repos", "endive-patterns"));
    const unresolved = ci.impacts.filter((i) => i.verdict === "unresolved").map((i) => i.site.file + ":" + i.site.line);
    expect(unresolved).toEqual(expect.arrayContaining(["src/dynamic/dyn.ts:4", "src/dynamic/dyn.ts:7"]));
    expect(rep.sites.find((s) => s.file === "src/dynamic/dyn.ts" && s.line === 10)?.reason).toMatch(/UNKNOWN: computed/);
  });

  it("a const object mutated after declaration is unresolved, not resolved-without-key", () => {
    src("a.ts", ["import Stripe from 'stripe';", "const s = new Stripe('x');", "const p: any = { mode: 'payment' };", "p.payment_method_types = ['card'];", "s.checkout.sessions.create(p);"].join("\n"));
    const { ci } = run(root);
    expect(ci.impacts.filter((i) => i.verdict !== "response_review").map((i) => i.verdict)).toEqual(["unresolved"]);
  });

  it("ignores objects that merely look like a Stripe client", () => {
    src("a.ts", "const stripe = { checkout: { sessions: { create: (x: unknown) => x } } };\nstripe.checkout.sessions.create({ payment_method_types: ['card'] });");
    expect(run(root).rep.sites).toEqual([]);
  });

  it("supports CommonJS require + factory call and typed dependency objects", () => {
    src("c.js", "const Stripe = require('stripe');\nconst s = Stripe('k');\ns.paymentIntents.create({ amount: 1, currency: 'usd', payment_method_types: ['card'] });");
    src("d.ts", "import type Stripe from 'stripe';\nexport const f = (deps: { stripe: Stripe }) => deps.stripe.setupIntents.create({ payment_method_types: ['card'] });");
    expect(breaks(run(root).ci)).toEqual(["c.js:3", "d.ts:2"]);
  });

  it("maps positional path params before the params object", () => {
    src("u.ts", "import Stripe from 'stripe';\nconst s = new Stripe('k');\ns.paymentIntents.update('pi_1', { payment_method_types: ['card'] });");
    const site = run(root).rep.sites[0]!;
    expect(site).toMatchObject({ method: "POST", path: "/v1/payment_intents/{*}", sdkMethod: "paymentIntents.update" });
    expect(site.payload.keys).toEqual(["payment_method_types"]);
  });
});
