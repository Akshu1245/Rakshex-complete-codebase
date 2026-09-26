/**
 * RaksHex Agent Firewall API — Cloudflare Workers entrypoint.
 *
 * Additive port of apps/api (Express stays intact). One worker, three
 * handlers: fetch (Hono REST), scheduled (cron fan-out), queue (job consumer).
 */
import { Hono } from "hono";
import type { Env } from "./env";
import { app as evaluateApp } from "./routes/evaluate";
import { app as receiptsApp } from "./routes/receipts";
import { app as healthApp } from "./routes/health";
import { app as waitlistApp } from "./routes/waitlist";
import { handleDecisionStream, isUpgradeRequest } from "./adapters/ws";
import { captureError } from "./adapters/sentry";
import { handleScheduled } from "./scheduled";
import { handleQueue } from "./queueConsumer";

const app = new Hono<{ Bindings: Env }>();

app.onError(async (err, c) => {
  await captureError(c.env, err, { path: c.req.path });
  return Response.json({ error: "Internal error" }, { status: 500 });
});

app.route("/v1/evaluate", evaluateApp);
app.route("/v1/receipts", receiptsApp);
app.route("/v1/health", healthApp);
app.route("/v1/waitlist", waitlistApp);

app.get("/v1/stream/decisions", (c) => {
  if (!isUpgradeRequest(c.req.raw)) {
    return Response.json({ error: "WebSocket upgrade required" }, { status: 426 });
  }
  const workspaceId = Number(c.req.query("workspaceId"));
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }
  return handleDecisionStream(c.req.raw, c.env, workspaceId);
});

app.get("/", (c) => c.json({ service: "rakshex-firewall-workers", version: "0.1.0" }));

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
  queue: handleQueue,
};
