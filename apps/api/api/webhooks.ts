/**
 * Lifecycle webhooks — tRPC router.
 *
 * Phase 25 feature. Lets users register HTTP endpoints that Rakshex will
 * call (with HMAC-signed bodies) when lifecycle events happen:
 *   - scan.complete
 *   - scan.started
 *   - finding.discovered      (fires for Critical & High findings)
 *   - quota.warning           (approaching monthly budget limit)
 *   - kill_switch.triggered   (budget exceeded, API shut down)
 *   - subscription.updated    (plan change)
 *
 * This generalises the hard-coded Slack integration. The Slack code path
 * stays — webhooks are *additive*, not a replacement, to avoid breaking
 * existing customers.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import dns from "dns/promises";
import { nanoid } from "nanoid";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { deliver, buildSignature, type WebhookEvent } from "../services/webhookDelivery";
import { ensurePersonalWorkspace } from "../services/workspaceContext";

/**
 * Returns true if `ip` is inside one of RFC1918 / link-local / loopback /
 * unique-local / carrier-grade NAT ranges — i.e. anything we would never
 * legitimately want to fire a webhook at. Accepts IPv4 and IPv6 literals.
 *
 * A literal hostname check catches the obvious case (`localhost`,
 * `127.0.0.1`), but a determined attacker can register a public hostname
 * that resolves to a private IP — so we also resolve before trusting the URL.
 */
function isPrivateIp(ip: string): boolean {
  // IPv6 loopback, link-local, unique-local.
  if (ip === "::1" || ip === "::") return true;
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true; // unique-local
  // IPv4-mapped IPv6 "::ffff:x.x.x.x" → strip prefix and fall through.
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = mapped ? mapped[1] : ip;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return false;
  const [a, b] = v4.split(".").map(Number);
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

const SUPPORTED_EVENTS = [
  "scan.complete",
  "scan.started",
  "finding.discovered",
  "quota.warning",
  "kill_switch.triggered",
  "subscription.updated",
] as const;

const eventSchema = z.enum(SUPPORTED_EVENTS);

/**
 * Only show the last 4 chars of the secret — receivers that lose it must
 * rotate. Same UX Stripe / GitHub use.
 */
function maskSecret(secret: string): string {
  if (secret.length <= 4) return "•".repeat(secret.length);
  return `${"•".repeat(Math.max(8, secret.length - 4))}${secret.slice(-4)}`;
}

function generateSecret(): string {
  // 32 bytes → 44 chars base64. Fits within the 128-varchar column.
  return crypto.randomBytes(32).toString("base64");
}

export const webhooksRouter = router({
  /**
   * List webhook events the server supports. Useful for dashboard UIs
   * so they don't hard-code the list.
   */
  listSupportedEvents: protectedProcedure.query(() => {
    return {
      events: SUPPORTED_EVENTS.map((e) => ({
        name: e,
        description: describeEvent(e),
      })),
    };
  }),

  /**
   * Create a new webhook endpoint. Returns the full secret exactly once;
   * subsequent list calls show only the masked form.
   */
  register: protectedProcedure
    .input(
      z.object({
        url: z.string().url().max(1024),
        events: z.array(eventSchema).min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // SSRF guard: a compromised account cannot use the webhook system as
      // an internal-network pivot. We enforce this in two layers because
      // literal-hostname matching alone can be bypassed by pointing a
      // public DNS name at a private IP (e.g. `internal.example.com` →
      // 10.0.0.5).
      //
      //   1. Refuse obvious localhost / .local literal hostnames.
      //   2. Resolve the hostname and refuse if any A/AAAA answer is a
      //      private/reserved address.
      //
      // Dev + test runs are skipped so local webhook receivers still work
      // during integration tests.
      if (process.env.NODE_ENV === "production") {
        const parsed = new URL(input.url);
        if (parsed.protocol !== "https:") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Webhook URLs must use HTTPS in production.",
          });
        }
        const hostname = parsed.hostname.toLowerCase();
        if (
          hostname === "localhost" ||
          hostname.endsWith(".local") ||
          hostname.endsWith(".internal") ||
          isPrivateIp(hostname)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Webhook URL may not target localhost or a private network address.",
          });
        }
        try {
          const addrs = await dns.lookup(hostname, { all: true });
          for (const addr of addrs) {
            if (isPrivateIp(addr.address)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Webhook hostname resolves to a private network address.",
              });
            }
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          // DNS failure — refuse the endpoint; better UX than a silent
          // "registered but never delivers" state.
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Could not resolve the webhook hostname. Check the URL and try again.",
          });
        }
      }

      const id = `wh_${nanoid(24)}`;
      const secret = generateSecret();
      // Migration 0019 added workspace_id; stamp personal workspace so new
      // endpoints are scoped (legacy rows were backfilled by the SQL migration).
      const workspace = await ensurePersonalWorkspace(ctx.user.id, ctx.user.name ?? null);

      await db.createWebhookEndpoint({
        id,
        userId: ctx.user.id,
        workspaceId: workspace.id,
        url: input.url,
        secret,
        events: input.events as unknown as object,
        isActive: true,
      });

      return {
        id,
        url: input.url,
        events: input.events,
        // Only returned here — NEVER on subsequent reads.
        secret,
        message:
          "Save this secret now — it will not be shown again. Use it to verify the X-Rakshex-Signature-256 header on incoming deliveries.",
      };
    }),

  /**
   * List the caller's webhook endpoints. Secrets are masked.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.listWebhookEndpointsByUserId(ctx.user.id);
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      events: Array.isArray(row.events) ? row.events : [],
      secretMasked: maskSecret(row.secret),
      isActive: row.isActive,
      lastDeliveryAt: row.lastDeliveryAt,
      lastStatus: row.lastStatus,
      consecutiveFailures: row.consecutiveFailures,
      createdAt: row.createdAt,
    }));
  }),

  /**
   * Toggle an endpoint active/inactive. Useful for pausing noisy webhooks
   * during an incident without losing the configuration.
   */
  setActive: protectedProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getWebhookEndpointById(input.id);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook endpoint not found",
        });
      }
      await db.updateWebhookEndpointActive(input.id, input.isActive);
      return { success: true };
    }),

  /**
   * Delete an endpoint (and its delivery history via CASCADE-equivalent
   * cleanup if we ever add one — for now, deliveries are kept for audit).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getWebhookEndpointById(input.id);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook endpoint not found",
        });
      }
      await db.deleteWebhookEndpoint(input.id);
      await db.createAuditLogEntry(ctx.user.id, "webhook_deleted", { endpointId: input.id });
      return { success: true };
    }),

  /**
   * Fire a synthetic event at the endpoint so users can verify their
   * receiver before relying on it in production. The payload is clearly
   * marked as a test event.
   */
  test: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const endpoint = await db.getWebhookEndpointById(input.id);
    if (!endpoint || endpoint.userId !== ctx.user.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }

    // Use the first event the endpoint subscribes to so we don't fire
    // for a type it filters out.
    const events = Array.isArray(endpoint.events) ? endpoint.events : [];
    const event = (events[0] ?? "scan.complete") as WebhookEvent;

    const results = await deliver(ctx.user.id, event, {
      test: true,
      message: "This is a test delivery from Rakshex.",
      endpointId: endpoint.id,
      triggeredBy: ctx.user.id,
    });

    return {
      delivered: results.length,
      results: results.map((r) => ({
        status: r.status,
        httpStatus: r.httpStatus,
        error: r.error,
      })),
    };
  }),

  /**
   * Inspect recent delivery attempts for an endpoint (success or failure).
   * Most recent first, capped at 50.
   */
  listDeliveries: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const endpoint = await db.getWebhookEndpointById(input.id);
      if (!endpoint || endpoint.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook endpoint not found",
        });
      }
      const rows = await db.listWebhookDeliveries(input.id, 50);
      return rows.map((row) => ({
        id: row.id,
        event: row.event,
        status: row.status,
        errorMessage: row.errorMessage,
        deliveredAt: row.deliveredAt,
        createdAt: row.createdAt,
      }));
    }),

  /**
   * Helper: compute the signature the server would send for a given body.
   * Used by customer integration tests (rare, but saves a support ticket).
   */
  computeSignature: protectedProcedure
    .input(z.object({ id: z.string(), body: z.string().max(65_536) }))
    .query(async ({ input, ctx }) => {
      const endpoint = await db.getWebhookEndpointById(input.id);
      if (!endpoint || endpoint.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook endpoint not found",
        });
      }
      return { signature: buildSignature(input.body, endpoint.secret) };
    }),
});

function describeEvent(event: (typeof SUPPORTED_EVENTS)[number]): string {
  switch (event) {
    case "scan.complete":
      return "Fires after every completed scan. Payload: scanId, riskLevel, totalFindings, summary.";
    case "scan.started":
      return "Fires when a scan begins. Useful to correlate with scan.complete.";
    case "finding.discovered":
      return "Fires for every new Critical or High severity finding (does not fire for existing findings).";
    case "quota.warning":
      return "Fires when LLM/API spend reaches 80% of the configured monthly limit.";
    case "kill_switch.triggered":
      return "Fires when Rakshex shuts off LLM traffic due to exceeding the budget.";
    case "subscription.updated":
      return "Fires when the user's plan changes (upgrade, downgrade, cancellation).";
  }
}
