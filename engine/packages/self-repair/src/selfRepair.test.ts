import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  assess, planPatch, runChecks, checksDigest, issueReceipt, verifyReceipt, runRepair, ApprovalError,
  type Impact, type RepairRule, type Principal, type Receipt, type Bound, type CheckSpec,
} from "./index.js";

const RULE: RepairRule = {
  id: "stripe-endive-checkout-pmt", changeIds: ["request-property-removed"], path: "/v1/checkout/sessions",
  removed: "payment_method_types", added: "allowed_payment_method_types", lowRiskValues: ["card"],
  source: "https://docs.stripe.com/changelog/endive/2026-09-30/remove-payment-method-types-checkout-sessions",
};
const impact = (line: number, extra: Partial<Impact> = {}): Impact => ({
  verdict: "breaks_call",
  change: { id: "request-property-removed", method: "POST", path: "/v1/checkout/sessions", property: "payment_method_types" },
  site: { file: "src/checkout.ts", line, column: 3, call: "stripe.checkout.sessions.create", sdkMethod: "checkout.sessions.create" },
  evidence: { payloadStatus: "resolved", matchedKeys: ["payment_method_types"], unresolved: [], via: [], reason: "" },
  ...extra,
});
const APP = `import Stripe from "stripe";
const stripe = new Stripe(process.env.K!);
export const a = () => stripe.checkout.sessions.create({ mode: "payment", payment_method_types: ["card"] });
export const b = () => stripe.checkout.sessions.create({ mode: "payment", payment_method_types: ["card", "ideal"] });
`;
const keys = generateKeyPairSync("ed25519");
const KEY = { keyId: "k1", privateKeyPem: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
const PUB = { k1: keys.publicKey.export({ type: "spki", format: "pem" }).toString() };
const who = (p: Partial<Principal> = {}) => ({ current: async () => ({ userId: "u_owner", workspaceId: "ws1", role: "owner", authenticated: true, ...p }) as Principal });
const OK: CheckSpec = { name: "node -e ok", cmd: process.execPath, args: ["-e", "process.exit(0)"], cwd: tmpdir() };
const BAD: CheckSpec = { name: "failing", cmd: process.execPath, args: ["-e", "process.exit(3)"], cwd: tmpdir() };

let base: string;
const fresh = () => { const d = mkdtempSync(join(tmpdir(), "sr-ws-")); cpSync(base, d, { recursive: true }); return d; };
beforeEach(() => { base = mkdtempSync(join(tmpdir(), "sr-")); mkdirSync(join(base, "src")); writeFileSync(join(base, "src/checkout.ts"), APP); });
afterEach(() => rmSync(base, { recursive: true, force: true }));

const common = (ws: string, impacts: Impact[], extra: object = {}) => ({
  title: "Stripe Endive checkout pmt", workspace: ws, repo: "o/r", baseSha: "abc", workspaceId: "ws1", impacts, rules: [RULE],
  siteValues: { "src/checkout.ts:3": { payment_method_types: "[card]" }, "src/checkout.ts:4": { payment_method_types: "[card,ideal]" } },
  checks: [OK], checksNotRun: [{ name: "real Stripe API", reason: "never called by design" }], publicKeys: PUB, ...extra,
});

describe("risk", () => {
  it("LOW only for documented rule + resolved payload + low-risk literal values", () => {
    expect(assess(impact(3), [RULE], { payment_method_types: "[card]" }).level).toBe("LOW");
    expect(assess(impact(4), [RULE], { payment_method_types: "[card,ideal]" }).level).toBe("HIGH");
    expect(assess(impact(3), [RULE], {}).level).toBe("HIGH");
    expect(assess(impact(3, { verdict: "possibly_breaks" }), [RULE], { payment_method_types: "[card]" }).level).toBe("HIGH");
    expect(assess(impact(3), [], { payment_method_types: "[card]" }).rule).toBeNull();
    expect(assess(impact(3, { semanticWarning: { note: "filters", source: "x" } }), [RULE], { payment_method_types: "[card]" }).level).toBe("HIGH");
  });
});

describe("bounded patch", () => {
  it("renames only the key on the target call line and produces a git-apply-able diff", () => {
    const p = planPatch(base, [{ file: "src/checkout.ts", line: 3, removed: RULE.removed, added: RULE.added }]);
    expect(p.edits[0]!.after.split("\n")[2]).toContain("allowed_payment_method_types");
    expect(p.edits[0]!.after.split("\n")[3]).toContain(" payment_method_types");
    execFileSync("git", ["init", "-q"], { cwd: base });
    writeFileSync(join(base, "p.diff"), p.diff);
    execFileSync("git", ["apply", "--check", "p.diff"], { cwd: base });
  });
  it("refuses to guess or escape the repo", () => {
    expect(() => planPatch(base, [{ file: "src/checkout.ts", line: 1, removed: RULE.removed, added: RULE.added }])).toThrow(/refusing to guess/);
    expect(() => planPatch(base, [{ file: "../x.ts", line: 1, removed: "a", added: "b" }])).toThrow(/outside repo/);
  });
});

describe("checks", () => {
  it("records passed / failed / not_run explicitly", () => {
    const c = runChecks([OK, BAD, { name: "missing", cmd: "/nonexistent-bin", args: [], cwd: tmpdir() }], [{ name: "e2e", reason: "no browser" }]);
    expect(c.map((x) => x.status)).toEqual(["passed", "failed", "not_run", "not_run"]);
  });
});

describe("approval receipts", () => {
  const bound = (): Bound => ({ repo: "o/r", baseSha: "abc", workspaceId: "ws1", patchDiff: "diff", impacts: [impact(4)], checks: runChecks([OK]), siteIds: ["src/checkout.ts:4"] });
  it("only authenticated owner/admin of the same workspace can issue", async () => {
    await expect(issueReceipt({ current: async () => null }, "APPROVED", bound(), KEY)).rejects.toThrow(ApprovalError);
    await expect(issueReceipt(who({ role: "member" }), "APPROVED", bound(), KEY)).rejects.toThrow(/role member/);
    await expect(issueReceipt(who({ workspaceId: "other" }), "APPROVED", bound(), KEY)).rejects.toThrow(/workspace/);
    await expect(issueReceipt(who({ role: "admin" }), "APPROVED", bound(), KEY)).resolves.toBeTruthy();
    await expect(issueReceipt(who(), "APPROVED", { ...bound(), checks: runChecks([BAD]) }, KEY)).rejects.toThrow(/check failed/);
  });
  it("verified only when signature AND every bound hash match", async () => {
    const b = bound();
    const r = await issueReceipt(who(), "APPROVED", b, KEY);
    expect(verifyReceipt(r, b, PUB).verified).toBe(true);
    const tampered: Receipt = { ...r, payload: { ...r.payload, approver: { userId: "u_owner", role: "owner" }, patchSha256: "0".repeat(64) } };
    const t = verifyReceipt(tampered, b, PUB);
    expect(t.signatureValid).toBe(false); expect(t.verified).toBe(false);
    const otherPatch = verifyReceipt(r, { ...b, patchDiff: "diff2" }, PUB);
    expect(otherPatch.signatureValid).toBe(true); expect(otherPatch.contentValid).toBe(false); expect(otherPatch.verified).toBe(false);
    expect(verifyReceipt(r, { ...b, checks: runChecks([OK], [{ name: "x", reason: "y" }]) }, PUB).problems.join()).toMatch(/checks hash/);
    expect(verifyReceipt(r, { ...b, impacts: [impact(3)] }, PUB).problems.join()).toMatch(/impact hash/);
    expect(verifyReceipt(r, b, { k1: generateKeyPairSync("ed25519").publicKey }).verified).toBe(false);
    expect(verifyReceipt(r, b, PUB, { now: new Date(Date.now() + 2 * 86400_000) }).verified).toBe(false);
    const seen = new Set<string>();
    expect(verifyReceipt(r, b, PUB, { seenNonces: seen }).verified).toBe(true);
    expect(verifyReceipt(r, b, PUB, { seenNonces: seen }).problems.join()).toMatch(/replayed/);
  });
});

describe("runRepair states", () => {
  it("all LOW: DRAFT_PR_READY with checks run and not-run listed", () => {
    const r = runRepair(common(fresh(), [impact(3)]));
    expect(r.status).toBe("DRAFT_PR_READY");
    expect(r.checks.map((c) => c.status)).toEqual(["passed", "not_run"]);
    expect(r.body).toMatch(/NOT RUN/);
  });
  it("HIGH site STOPS without receipt; patch prepared but status not ready", () => {
    const r = runRepair(common(fresh(), [impact(3), impact(4)]));
    expect(r.status).toBe("STOPPED_NEEDS_REVIEW");
    expect(r.approvalScope.siteIds).toEqual(["src/checkout.ts:4"]);
    expect(r.body).toMatch(/STOPPED: human review/);
  });
  it("valid owner receipt releases exactly the reviewed patch; mismatched or member receipts do not", async () => {
    const dry = runRepair(common(fresh(), [impact(3), impact(4)]));
    const b: Bound = { repo: "o/r", baseSha: "abc", workspaceId: "ws1", patchDiff: dry.patch!.diff, impacts: dry.approvalScope.impacts, checks: dry.checks, siteIds: dry.approvalScope.siteIds };
    const receipt = await issueReceipt(who(), "APPROVED", b, KEY);
    const ok = runRepair(common(fresh(), [impact(3), impact(4)], { receipt }));
    expect(ok.receipt?.verified).toBe(true); expect(ok.status).toBe("DRAFT_PR_READY");
    // receipt for a different base commit -> rejected, stays STOPPED
    const other = runRepair(common(fresh(), [impact(3), impact(4)], { receipt, baseSha: "def" }));
    expect(other.status).toBe("STOPPED_NEEDS_REVIEW"); expect(other.receipt?.verified).toBe(false);
    // forged role in payload -> signature fails
    const forged = { ...receipt, payload: { ...receipt.payload, approver: { userId: "u_m", role: "admin" as const } } };
    expect(runRepair(common(fresh(), [impact(3), impact(4)], { receipt: forged })).status).toBe("STOPPED_NEEDS_REVIEW");
  });
  it("REFUSED is preserved and terminal", async () => {
    const dry = runRepair(common(fresh(), [impact(3), impact(4)]));
    const b: Bound = { repo: "o/r", baseSha: "abc", workspaceId: "ws1", patchDiff: dry.patch!.diff, impacts: dry.approvalScope.impacts, checks: dry.checks, siteIds: dry.approvalScope.siteIds };
    const receipt = await issueReceipt(who({ role: "admin" }), "REFUSED", b, KEY, { reason: "ideal not enabled" });
    const r = runRepair(common(fresh(), [impact(3), impact(4)], { receipt }));
    expect(r.status).toBe("REFUSED");
  });
  it("failed check -> CHECKS_FAILED even with receipt; unknown rule -> STOPPED with checks not_run", () => {
    expect(runRepair(common(fresh(), [impact(3)], { checks: [BAD] })).status).toBe("CHECKS_FAILED");
    const r = runRepair(common(fresh(), [impact(3, { change: { id: "request-property-type-changed", method: "POST", path: "/v1/x", property: "y" } })]));
    expect(r.status).toBe("STOPPED_NEEDS_REVIEW");
    expect(r.checks.every((c) => c.status === "not_run")).toBe(true);
    expect(readFileSync(join(base, "src/checkout.ts"), "utf8")).toBe(APP);
  });
});
