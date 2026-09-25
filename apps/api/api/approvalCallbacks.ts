/**
 * Signed approval-callback route.
 *
 *   GET /api/approval-callbacks?approvalId=…&decision=approve|reject&exp=…&sig=…
 *
 * The signed URL is a bearer capability minted by `alertDispatcher` when an
 * approval-requested alert goes out (Slack / Teams / email). Hitting it
 * consumes the approval with the same semantics as the tRPC
 * `agentFirewall.approvals.resolve` mutation: APPROVE → the action proceeds
 * (agent's `consume` step then allows it); REJECT → the ledger records DENY
 * and the response carries an HMAC-signed receipt.
 *
 * Auth is the HMAC itself (`verifyApprovalCallback`): expiry, decision
 * enum, and timing-safe signature comparison. Route is IP rate-limited.
 */

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";

import { actionApprovals, actionLedger } from "@rakshex/database";
import * as db from "../db";
import { logger } from "../_core/logger";
import {
  signReceipt,
  verifyApprovalCallback,
  type ApprovalCallbackDecision,
  type VerifyFailureReason,
} from "../services/approvalCallbacks";

const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // signed-link clicks are human-paced; 60/min/IP is generous
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many approval-callback requests." },
});

export function registerApprovalCallbackRoutes(app: Express): void {
  app.get("/api/approval-callbacks", callbackLimiter, async (req: Request, res: Response) => {
    const params = {
      approvalId: asStr(req.query.approvalId),
      decision: asStr(req.query.decision),
      exp: asStr(req.query.exp),
      sig: asStr(req.query.sig),
    };
    const verified = verifyApprovalCallback(params);
    // NOTE: this repo's tsconfig is strict:false, so discriminated-union
    // narrowing doesn't apply — extract each branch via one cast.
    type VerifiedOk = { ok: true; approvalId: string; decision: ApprovalCallbackDecision };
    type VerifiedFail = { ok: false; reason: VerifyFailureReason };
    const failure = verified.ok ? null : (verified as VerifiedFail);
    if (failure) {
      logger.warn({ reason: failure.reason }, "[ApprovalCallback] rejected");
      res.status(failure.reason === "expired" ? 410 : 403).json({
        error: `callback ${failure.reason}`,
      });
      return;
    }
    const ok = verified as VerifiedOk;
    try {
      const result = await consumeApproval(ok.approvalId, ok.decision);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const receipt = signReceipt({
      approvalId: ok.approvalId,
      decision: ok.decision,
      workspaceId: result.workspaceId,
      ledgerId: result.ledgerId,
      effectiveDecision: result.effectiveDecision,
      decidedAt: new Date().toISOString(),
      decidedVia: "signed-callback",
    });
    res.type("html").send(renderReceiptPage(ok.decision, result.effectiveDecision, receipt));
    } catch (err) {
      logger.error({ err }, "[ApprovalCallback] failed");
      res.status(500).json({ error: "callback failed" });
    }
  });
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

interface ConsumeResult {
  ok: boolean;
  status: number;
  error?: string;
  workspaceId?: number;
  ledgerId?: string;
  effectiveDecision?: "ALLOW" | "DENY";
}

/**
 * Same lifecycle as the tRPC `resolve` mutation: pending + unexpired +
 * single transition inside a transaction, ledger gets ALLOW/DENY.
 */
async function consumeApproval(
  approvalId: string,
  decision: ApprovalCallbackDecision,
): Promise<ConsumeResult> {
  const database = await db.getDb();
  if (!database) return { ok: false, status: 503, error: "DB unavailable" };

  const [approval] = await database
    .select()
    .from(actionApprovals)
    .where(and(eq(actionApprovals.id, approvalId), eq(actionApprovals.status, "pending")))
    .limit(1);
  if (!approval) {
    return { ok: false, status: 404, error: "pending approval not found or already resolved" };
  }
  if (approval.expiresAt <= new Date()) {
    await database
      .update(actionApprovals)
      .set({ status: "expired" })
      .where(eq(actionApprovals.id, approval.id));
    return { ok: false, status: 410, error: "approval expired" };
  }

  const effectiveDecision = decision === "approve" ? "ALLOW" : "DENY";
  await database.transaction(async (tx) => {
    await tx
      .update(actionApprovals)
      .set({
        status: decision === "approve" ? "approved" : "rejected",
        resolvedAt: new Date(),
        resolutionNote: "resolved via signed alert callback",
      })
      .where(eq(actionApprovals.id, approval.id));
    await tx
      .update(actionLedger)
      .set({ effectiveDecision })
      .where(
        and(eq(actionLedger.id, approval.ledgerId), eq(actionLedger.workspaceId, approval.workspaceId)),
      );
  });
  await db.createAuditLogEntry(0, `action_approval_${decision}d_callback`, {
    approvalId: approval.id,
    ledgerId: approval.ledgerId,
    workspaceId: approval.workspaceId,
  });

  logger.info(
    { approvalId: approval.id, decision },
    "[ApprovalCallback] approval consumed via signed link",
  );
  return {
    ok: true,
    status: 200,
    workspaceId: approval.workspaceId,
    ledgerId: approval.ledgerId,
    effectiveDecision,
  };
}

function renderReceiptPage(
  decision: ApprovalCallbackDecision,
  effectiveDecision: "ALLOW" | "DENY",
  receipt: Record<string, unknown> | null,
): string {
  const headline = decision === "approve" ? "✅ Action approved" : "⛔ Action denied";
  const detail =
    decision === "approve"
      ? "The agent may now proceed — the approval has been consumed."
      : "The action was denied and recorded in the tamper-evident ledger.";
  const receiptJson = receipt ? JSON.stringify(receipt, null, 2) : "unavailable";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${headline}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px">
<h1>${headline}</h1><p>${detail}</p>
<p>Effective decision: <strong>${effectiveDecision}</strong></p>
<h2>Signed receipt</h2><pre style="background:#f3f4f6;padding:12px;overflow:auto">${escapeHtml(receiptJson)}</pre>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
