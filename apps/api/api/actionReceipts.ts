import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { assertWorkspacePermission } from "../services/workspaceContext";
import {
  exportReceiptBundle,
  receiptBundleJson,
  renderSignedReceiptPdf,
} from "../services/receipts/actionReceipts";

const exportInput = z.object({
  workspaceId: z.number().int().positive(),
  requestId: z.string().min(1).max(128).optional(),
});

async function assertRead(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "audit", "read");
}

function fileStem(requestId?: string) {
  const safe = requestId?.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return safe ? `rakshex-receipt-${safe}` : "rakshex-receipt-chain";
}

export const actionReceiptsRouter = router({
  exportJson: protectedProcedure.input(exportInput).query(async ({ input, ctx }) => {
    const workspaceId = input.workspaceId;
    await assertRead(workspaceId, ctx.user.id);
    const bundle = await exportReceiptBundle({
      workspaceId,
      requestId: input.requestId,
    });
    return {
      filename: `${fileStem(input.requestId)}.json`,
      mediaType: "application/json",
      chainHead: bundle.chainHead,
      signingKeyId: bundle.bundleSigningKeyId,
      content: receiptBundleJson(bundle),
    };
  }),

  exportPdf: protectedProcedure.input(exportInput).query(async ({ input, ctx }) => {
    const workspaceId = input.workspaceId;
    await assertRead(workspaceId, ctx.user.id);
    const bundle = await exportReceiptBundle({
      workspaceId,
      requestId: input.requestId,
    });
    const pdf = renderSignedReceiptPdf(bundle);
    return {
      filename: `${fileStem(input.requestId)}.pdf`,
      mediaType: "application/pdf",
      chainHead: bundle.chainHead,
      signingKeyId: bundle.bundleSigningKeyId,
      contentBase64: pdf.toString("base64"),
    };
  }),
});
