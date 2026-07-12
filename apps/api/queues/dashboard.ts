// @ts-nocheck — @bull-board packages are optional; only compiled when installed
import type { Express } from "express";
import { scanQueue, webhookQueue, emailQueue } from "./index";
import { logger } from "../_core/logger";

export async function mountBullBoard(app: Express): Promise<void> {
  try {
    const { createBullBoard } = await import("@bull-board/api");
    const { BullMQAdapter } = await import("@bull-board/api/bullMQAdapter");
    const { ExpressAdapter } = await import("@bull-board/express");

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");

    createBullBoard({
      queues: [
        new BullMQAdapter(scanQueue),
        new BullMQAdapter(webhookQueue),
        new BullMQAdapter(emailQueue),
      ],
      serverAdapter,
    });

    app.use("/admin/queues", serverAdapter.getRouter());
    logger.info("[BullBoard] Mounted at /admin/queues");
  } catch {
    logger.warn("[BullBoard] @bull-board packages not installed — skipping dashboard");
  }
}
