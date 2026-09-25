/**
 * Receipts tRPC router — auditor-facing signed receipt export.
 *
 * `export` builds a single downloadable ZIP (signed receipts + hash-chain
 * verification data + plain-English README + offline verify.sh). The HTTP
 * surface in this stack is `POST /api/trpc/receipts.export`; the response
 * carries the bundle inline as base64, mirroring dataExport's inline mode.
 *
 * Authorization: workspace-scoped read (`assertWorkspacePermission … "read"`);
 * the caller never supplies a user id — ctx.user is the tenant.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { ValidationError } from "../_core/errors";
import * as db from "../db";
import { assertWorkspacePermission } from "../services/workspaceContext";
import {
  MAX_RECEIPT_EXPORT,
  assembleReceiptExportZip,
  buildReceiptBundle,
  fetchReceiptEntries,
  type ReceiptExportSelector,
} from "../services/receipts/receiptBundleExport";

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });

const selectorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ids"),
    receiptIds: z.array(z.number().int().positive()).min(1).max(MAX_RECEIPT_EXPORT),
  }),
  z.object({
    kind: z.literal("action"),
    actionId: z.string().min(1).max(128),
  }),
  z.object({
    kind: z.literal("range"),
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
]);

export const receiptsRouter = router({
  /**
   * Export signed action receipts as one downloadable bundle.
   *
   * Selector picks the receipts:
   *   - { kind: "ids", receiptIds } — explicit entry ids (workspace-scoped)
   *   - { kind: "action", actionId } — chain prefix up to the last receipt
   *     for a request id, so the chain stays verifiable from genesis
   *   - { kind: "range", from, to } — ISO datetimes bounding occurredAt
   */
  export: protectedProcedure
    .input(workspaceInput.extend({ selector: selectorSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "policies", "read");
      if (!(await db.getDb())) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      let selector: ReceiptExportSelector;
      const s = input.selector;
      if (s.kind === "ids") selector = { kind: "ids", receiptIds: s.receiptIds };
      else if (s.kind === "action") selector = { kind: "action", actionId: s.actionId };
      else {
        if (new Date(s.from).getTime() > new Date(s.to).getTime()) {
          throw new ValidationError("date range is inverted: from must be before to");
        }
        selector = { kind: "range", from: s.from, to: s.to };
      }

      let entries;
      try {
        entries = await fetchReceiptEntries(input.workspaceId, selector);
      } catch (err) {
        throw new ValidationError(err instanceof Error ? err.message : "Receipt fetch failed");
      }

      let bundle;
      try {
        bundle = buildReceiptBundle(entries, input.workspaceId);
      } catch (err) {
        // signerFromEnvironment throws when signing keys are not configured.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            err instanceof Error && /not configured/i.test(err.message)
              ? "Receipt signing is not configured: set RAKSHEX_RECEIPT_SIGNING_PRIVATE_KEY and RAKSHEX_RECEIPT_SIGNING_KEY_ID"
              : "Failed to sign receipt bundle",
        });
      }

      const exportedBy = ctx.user.email ?? `user:${ctx.user.id}`;
      const download = await assembleReceiptExportZip(bundle, exportedBy);

      await db.createAuditLogEntry(ctx.user.id, "receipt_bundle_exported", {
        workspaceId: input.workspaceId,
        recordCount: download.recordCount,
        chainHead: download.chainHead,
        sha256: download.sha256,
        selector: input.selector.kind,
      });

      return {
        filename: download.filename,
        contentType: download.contentType,
        recordCount: download.recordCount,
        chainHead: download.chainHead,
        sha256: download.sha256,
        // Base64 — tRPC JSON serialises Buffer poorly otherwise.
        bodyBase64: download.body.toString("base64"),
      };
    }),
});
