import { z } from "zod";
import { router, protectedProcedure, editorProcedure } from "../../_core/trpc";
import * as db from "../../db";
import { iso27001Controls } from "../../../drizzle/schema-enterprise";
import { eq } from "drizzle-orm";
import { assessIso27001 } from "../../services/compliance/iso27001/controls";
import { requireEnterpriseRead, requireEnterpriseWrite } from "./workspaceAuth";

const ws = z.object({ workspaceId: z.number() });

export const enterpriseComplianceRouter = router({
  assessIso27001: editorProcedure.input(ws).mutation(async ({ input, ctx }) => {
    await requireEnterpriseWrite(input.workspaceId, ctx.user.id);
    await assessIso27001(input.workspaceId);
    return { success: true, message: "ISO27001 assessment complete" };
  }),

  listIso27001Controls: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return [];
    return d!
      .select()
      .from(iso27001Controls)
      .where(eq(iso27001Controls.workspaceId, input.workspaceId))
      .orderBy(iso27001Controls.controlId);
  }),

  getIso27001Summary: protectedProcedure.input(ws).query(async ({ input, ctx }) => {
    await requireEnterpriseRead(input.workspaceId, ctx.user.id);
    const d = await db.getDb();
    if (!d) return { compliant: 0, partial: 0, nonCompliant: 0, notAssessed: 0, overallScore: 0 };

    const controls = await d!
      .select()
      .from(iso27001Controls)
      .where(eq(iso27001Controls.workspaceId, input.workspaceId));
    const summary: Record<string, number> = {
      compliant: 0,
      partial: 0,
      non_compliant: 0,
      not_assessed: 0,
    };
    let totalScore = 0;

    for (const c of controls) {
      const s = c.status || "not_assessed";
      summary[s] = (summary[s] ?? 0) + 1;
      totalScore += Number(c.score ?? 0);
    }

    return {
      compliant: summary.compliant,
      partial: summary.partial,
      nonCompliant: summary.non_compliant,
      notAssessed: summary.not_assessed,
      overallScore: controls.length > 0 ? Math.round((totalScore / controls.length) * 10) / 10 : 0,
    };
  }),
});
