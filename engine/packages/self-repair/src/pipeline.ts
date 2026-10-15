import type { Impact, RepairRule } from "./types.js";
import { siteId } from "./types.js";
import { assess, type Assessment } from "./risk.js";
import { planPatch, applyPatch, type PatchResult, type PatchTarget } from "./patch.js";
import { runChecks, allPassed, type CheckRecord, type CheckSpec } from "./checks.js";
import { verifyReceipt, type Receipt, type Bound } from "./approval.js";
import { renderPrBody, renderReview } from "./report.js";

export type RepairStatus = "NOT_AFFECTED" | "STOPPED_NEEDS_REVIEW" | "REFUSED" | "CHECKS_FAILED" | "DRAFT_PR_READY";
export interface RepairInput {
  title: string;
  /** An ISOLATED scratch checkout. The candidate patch is written here so checks can run on it. */
  workspace: string; repo: string; baseSha: string; workspaceId: string;
  impacts: Impact[]; rules: RepairRule[]; siteValues?: Record<string, Record<string, string>>;
  checks: CheckSpec[]; checksNotRun?: { name: string; reason: string }[];
  receipt?: Receipt; publicKeys?: Record<string, string>; now?: Date; seenNonces?: Set<string>;
}
export interface RepairReport {
  status: RepairStatus; title: string; assessments: Assessment[]; approvedSites: string[];
  patch?: PatchResult; patchSha256?: string; checks: CheckRecord[]; problems: string[];
  /** Exactly what an approver must sign: HIGH-risk site ids, patch, impacts, checks. */
  approvalScope: { siteIds: string[]; impacts: Impact[] };
  receipt?: { verified: boolean; signatureValid: boolean; contentValid: boolean; approver: string; decision?: string; problems: string[] };
  body: string;
}

/**
 * Order: assess -> plan bounded patch -> write candidate to scratch workspace -> run checks
 * -> gate. A HIGH-risk site is released only by a receipt whose signature AND bound hashes
 * (patch, impacts, checks) verify. STOPPED / REFUSED / CHECKS_FAILED are terminal for this run.
 */
export function runRepair(i: RepairInput): RepairReport {
  const breaking = i.impacts.filter((x) => x.verdict !== "response_review");
  const r: RepairReport = { status: "NOT_AFFECTED", title: i.title, assessments: [], approvedSites: [], checks: [], problems: [], approvalScope: { siteIds: [], impacts: breaking }, body: "" };
  if (!breaking.length) { r.body = "No request-side impact."; return r; }
  r.assessments = breaking.map((x) => assess(x, i.rules, i.siteValues?.[siteId(x)] ?? {}));
  const notRunAll = (why: string) => runChecks([], [...i.checks.map((c) => ({ name: c.name, reason: why })), ...(i.checksNotRun ?? [])]);
  // A site is mechanically patchable only if a rule exists AND the bounded codemod finds the key exactly once.
  const unpatchable = new Set<string>();
  const targets: PatchTarget[] = [];
  for (const a of r.assessments) {
    if (!a.rule) { unpatchable.add(a.id); continue; }
    const t = { file: a.impact.site.file, line: a.impact.site.line, removed: a.rule.removed, added: a.rule.added };
    if (targets.some((x) => x.file === t.file && x.line === t.line && x.removed === t.removed)) continue;
    try { planPatch(i.workspace, [t]); targets.push(t); }
    catch (e) { unpatchable.add(a.id); a.level = "HIGH"; a.autoApprovable = false; a.reasons.push(`Not mechanically patchable: ${(e as Error).message}. A human must edit this site.`); }
  }
  for (const a of r.assessments) if (!a.rule) a.reasons.push("No documented mechanical repair rule; a human must write the fix.");
  r.approvalScope.siteIds = [...new Set(r.assessments.filter((a) => !a.autoApprovable && !unpatchable.has(a.id)).map((a) => a.id))].sort();
  if (unpatchable.size) r.problems.push(`${unpatchable.size} site(s) not mechanically patchable (approval cannot release them): ${[...unpatchable].join(", ")}`);
  if (!targets.length) {
    r.checks = notRunAll("not run: STOPPED, nothing mechanically patchable");
    r.status = "STOPPED_NEEDS_REVIEW"; r.body = renderReview(r); return r;
  }
  r.patch = planPatch(i.workspace, targets); r.patchSha256 = r.patch.sha256;
  applyPatch(i.workspace, r.patch);
  r.checks = runChecks(i.checks, i.checksNotRun);
  if (!allPassed(r.checks)) { r.status = "CHECKS_FAILED"; r.body = renderReview(r); return r; }

  if (i.receipt) {
    const bound: Bound = { repo: i.repo, baseSha: i.baseSha, workspaceId: i.workspaceId, patchDiff: r.patch.diff, impacts: breaking, checks: r.checks, siteIds: r.approvalScope.siteIds };
    const v = verifyReceipt(i.receipt, bound, i.publicKeys ?? {}, { now: i.now, seenNonces: i.seenNonces });
    r.receipt = { verified: v.verified, signatureValid: v.signatureValid, contentValid: v.contentValid, approver: `${i.receipt.payload?.approver?.userId} (${i.receipt.payload?.approver?.role})`, decision: v.decision, problems: v.problems };
    if (v.verified && v.decision === "REFUSED") { r.status = "REFUSED"; r.body = renderReview(r); return r; }
    if (v.verified && v.decision === "APPROVED") r.approvedSites = r.approvalScope.siteIds;
    else r.problems.push(...v.problems.map((p) => `receipt rejected: ${p}`));
  }
  if (unpatchable.size || r.assessments.some((a) => !a.autoApprovable && !r.approvedSites.includes(a.id))) {
    r.status = "STOPPED_NEEDS_REVIEW"; r.body = renderReview(r); return r;
  }
  r.status = "DRAFT_PR_READY"; r.body = renderPrBody(r);
  return r;
}
