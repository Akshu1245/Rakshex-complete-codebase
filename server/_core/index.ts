import "dotenv/config";
/**
 * Initialize OpenTelemetry SDK BEFORE any other imports.
 * OTel patches global modules (http, express, ioredis, mysql2)
 * and MUST run before those modules are loaded.
 */
import "./tracing";

import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import crypto from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleOAuthRoutes } from "./googleOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV, validateEnv } from "./env";
import { accessLogMiddleware, logger, requestIdMiddleware } from "./logger";
import {
  createAllLimiters,
  AUTH_ROUTE_PATTERNS,
  SCAN_ROUTE_PATTERNS,
  API_KEY_ROUTE_PATTERNS,
} from "./rateLimiter";
import { sdk } from "./sdk";
import { wsManager } from "../websocket";
import { handleGitHubPush, handleGitHubPullRequest, verifyGitHubWebhook } from "../github";
import { scheduleWeeklyDigest } from "../jobs/weeklyDigest";
import { startRedTeamScheduler } from "../services/redTeamScheduler";
import { registerJobWorkers } from "../services/jobs";
import { verifyWebhookSignature } from "../utils/security";
import { handleGitHubWebhook } from "../api/github";
import { redis } from "./cache";
import { getDb } from "../db";

// ============================================================================
// CORS ORIGIN ALLOWLIST
// ============================================================================
//
// In production we only accept requests from the public marketing site
// + the dashboard origin. Wildcard / dynamic-reflection CORS would let
// any site that tricks a logged-in user into loading a malicious page
// read tRPC responses (the cookie is `SameSite=Lax`, so a strict CORS
// policy is the second line of defence). In dev we allow Vite +
// Next.js's default ports for ergonomics.
//
// `FRONTEND_URL` is added on top of the static list so single-tenant
// self-hosters can override the dashboard origin without forking.
function buildCorsAllowlist(): string[] {
  if (ENV.isProduction) {
    return [
      "https://rakshex.in",
      "https://www.rakshex.in",
      "https://app.rakshex.in",
      ENV.frontendUrl,
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);
  }
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
    ENV.frontendUrl,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);
}

// ============================================================================
// STARTUP VALIDATION — fail fast if critical config is missing
// ============================================================================
//
// Shape validation (URL format, JWT_SECRET length, PORT type) lives in
// `env.ts` and runs at module load time. This wrapper just calls into
// the policy validator (`validateEnv`) and logs a single confirmation
// line via pino so structured-log aggregators can key off it.
function validateEnvironment() {
  validateEnv();
  logger.info({ env: ENV.nodeEnv }, "[Config] Environment validated");
}

// ============================================================================
// PORT DISCOVERY
// ============================================================================

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ============================================================================
// SERVER BOOTSTRAP
// ============================================================================

// ============================================================================
// SENTRY PII SCRUBBING
// ============================================================================

/**
 * Field names that should never leave the process in plain text. The list is
 * intentionally small — bloating it has a cost (false positives make real
 * debugging harder). Extend carefully.
 */
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "newpassword",
  "oldpassword",
  "passwordhash",
  "apikey",
  "api_key",
  "secret",
  "token",
  "refresh_token",
  "access_token",
  "sessiontoken",
  "x-razorpay-signature",
  "x-rakshex-signature-256",
  "stripe-signature",
]);

function scrubValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > 0) return "[REDACTED]";
  return null;
}

function scrubObject(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) {
    return input.map((v) => scrubObject(v, depth + 1));
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = scrubValue(v);
      } else {
        out[k] = scrubObject(v, depth + 1);
      }
    }
    return out;
  }
  return input;
}

function scrubSentryEvent(event: Sentry.Event): void {
  if (event.request) {
    event.request.headers = scrubObject(event.request.headers) as typeof event.request.headers;
    event.request.cookies = scrubObject(event.request.cookies) as typeof event.request.cookies;
    event.request.data = scrubObject(event.request.data);
    // Strip query-string values that match SENSITIVE_KEYS.
    if (typeof event.request.query_string === "string") {
      event.request.query_string = event.request.query_string.replace(
        /([^=&?]+)=([^&]+)/g,
        (match, rawKey) =>
          SENSITIVE_KEYS.has(String(rawKey).toLowerCase()) ? `${rawKey}=[REDACTED]` : match,
      );
    }
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts) as typeof event.contexts;
  }
}

async function startServer() {
  // Validate config before starting anything
  validateEnvironment();

  if (ENV.sentryDsn) {
    Sentry.init({
      dsn: ENV.sentryDsn,
      environment: ENV.isProduction ? "production" : "development",
      // Lower than 100% in production to keep the monthly quota sane on
      // bursty traffic; sampled at the ingest layer, so traces still have
      // enough signal for debugging.
      tracesSampleRate: ENV.isProduction ? 0.1 : 1.0,
      // Strip obvious PII before sending events upstream. Sentry's default
      // "sendDefaultPii: false" would already drop IP + session cookies,
      // but this is an extra belt-and-braces pass for fields that slip
      // through (Authorization headers, secrets in querystrings, etc.).
      beforeSend(event) {
        scrubSentryEvent(event);
        return event;
      },
      beforeSendTransaction(event) {
        scrubSentryEvent(event);
        return event;
      },
    });
    logger.info("[Sentry] Initialized automatically.");
  }

  const app = express();
  const server = createServer(app);

  // ── Request ID + correlation ID + per-request logger ─────────────────────
  // Must be the very first middleware so every other handler (including
  // CORS / helmet errors) can reference req.id when something goes wrong.
  app.use(requestIdMiddleware());

  // ── CORS allowlist (must run before helmet) ──────────────────────────────
  // The Next.js dashboard (rakshex-frontend) is deployed on a different
  // origin from the API in most production setups, so we explicitly opt
  // in to credentialled cross-origin requests from the allowlist. Any
  // request from an origin not on the list is rejected before tRPC ever
  // sees it.
  const corsAllowlist = buildCorsAllowlist();
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin requests (server-to-server, curl, mobile native
        // clients) don't send Origin — let those through.
        if (!origin) return callback(null, true);
        if (corsAllowlist.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key", "X-Requested-With"],
    }),
  );

  // ── Trust the first hop reverse proxy in production ──────────────────────
  // Rate-limiting and cookie security flags depend on the real client IP,
  // not the proxy's IP. Setting `trust proxy = 1` tells Express to read
  // `X-Forwarded-For` for one hop (Railway, Cloudflare Tunnel, Fly's proxy,
  // etc.). Setting it higher would let spoofed `X-Forwarded-For` headers
  // bypass our rate limits, so we keep it tight.
  if (ENV.isProduction) {
    app.set("trust proxy", 1);
  }

  // ── Remove the default `X-Powered-By: Express` fingerprint header ────────
  // No functional purpose, just tells attackers exactly what stack to target.
  app.disable("x-powered-by");

  // ── Security headers (helmet.js) ───────────────────────────────────────────
  // Generate nonce for inline scripts
  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("hex");
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: ENV.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                (_req: unknown, res: unknown) =>
                  `'nonce-${(res as { locals: { cspNonce: string } }).locals.cspNonce}'`,
              ],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              connectSrc: ["'self'", "ws:", "wss:"],
              fontSrc: ["'self'", "data:"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      frameguard: ENV.isProduction ? { action: "sameorigin" } : false,
      hsts: ENV.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      // Modern isolation headers. Prevents our origin from being
      // coerced into cross-origin popup attacks and leaks timing info
      // across origins. Helmet disables these by default because they
      // can break third-party embeds — we don't embed so it's safe.
      crossOriginEmbedderPolicy: ENV.isProduction ? { policy: "require-corp" } : false,
      crossOriginOpenerPolicy: ENV.isProduction ? { policy: "same-origin" } : false,
      crossOriginResourcePolicy: ENV.isProduction ? { policy: "same-site" } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  // ── Permissions-Policy (browser feature lockdown) ─────────────────────────
  // Tells browsers to never grant our pages dangerous capabilities (camera,
  // mic, geolocation, payments API, etc.) even if something injected tries
  // to use them. This is a defense-in-depth layer on top of CSP.
  if (ENV.isProduction) {
    app.use((_req, res, next) => {
      res.setHeader(
        "Permissions-Policy",
        [
          "accelerometer=()",
          "camera=()",
          "geolocation=()",
          "gyroscope=()",
          "magnetometer=()",
          "microphone=()",
          "payment=()",
          "usb=()",
          "interest-cohort=()", // Disable FLoC / Topics API tracking
        ].join(", "),
      );
      // Make sure caches + CDN intermediaries can't serve authenticated
      // tRPC responses to unauthenticated callers.
      res.setHeader("Vary", "Cookie, Authorization, Origin");
      next();
    });
  }

  // ── Response compression (gzip + brotli when supported by the client) ─────
  // Skip compression for tiny responses and for SSE/streaming endpoints so
  // we don't introduce BREACH-style side channels on pages that reflect
  // secrets. The `compression` library's default filter already respects
  // `Cache-Control: no-transform` and bails for responses that opt out via
  // `x-no-compression`.
  app.use(
    compression({
      threshold: 1024, // bytes — smaller payloads skip compression
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        // Never compress the Server-Sent-Events / WS upgrade paths — we
        // don't run SSE today but this future-proofs the middleware.
        const accept = String(req.headers.accept || "");
        if (accept.includes("text/event-stream")) return false;
        return compression.filter(req, res);
      },
    }),
  );

  // ── Body parsers ─────────────────────────────────────────────────────────
  // Default: 5MB. Override per-route below for legitimate large payloads.
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // Collection endpoints: 1MB max (prevents DoS via massive JSON)
  app.use("/api/trpc/collections", express.json({ limit: "1mb" }));

  // GitHub webhooks & internal gateway audit: 1MB
  app.use("/webhooks/github", express.json({ limit: "1mb" }));
  app.use("/api/internal/gateway-audit", express.json({ limit: "1mb" }));
  app.use("/api/internal/shadow-ai-events", express.json({ limit: "1mb" }));

  // ── Access log (after body parsers so log fires once per request, but
  // before app routes so 404s are still captured). ─────────────────────────
  app.use(accessLogMiddleware());

  // ── Rate limiting (tiered, Redis-backed) ──────────────────────────────────
  // Limiters are built once at startup and reused. Internal service
  // requests (health checks, monitoring) can bypass rate limiting by
  // setting the X-Internal-Service header to INTERNAL_SERVICE_SECRET.
  const { globalLimiter, authLimiter, scanLimiter, apiKeyLimiter } = await createAllLimiters();

  // Base layer: global limiter applies to every request
  app.use(globalLimiter);

  // Per-route limiters: apply more restrictive buckets on top
  app.use("/api/trpc", (req, res, next) => {
    const url = req.originalUrl || req.url || "";

    // Auth routes: 20/15min per IP
    if (AUTH_ROUTE_PATTERNS.some((p) => url.includes(p))) {
      return authLimiter(req, res, next);
    }

    // Scan trigger routes: 100/hour per userId
    if (SCAN_ROUTE_PATTERNS.some((p) => url.includes(p))) {
      return scanLimiter(req, res, next);
    }

    // SDK ingest routes: 500/min per API key
    if (API_KEY_ROUTE_PATTERNS.some((p) => url.includes(p))) {
      return apiKeyLimiter(req, res, next);
    }

    return next();
  });

  app.use("/api/oauth", authLimiter);

  // ── Health check endpoint ──────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    const checks: Record<string, "ok" | "error"> = {};
    let allOk = true;

    // Database check
    try {
      const db = await getDb();
      if (db) {
        // lightweight query — just verify connection is alive
        await db.execute("SELECT 1");
        checks.database = "ok";
      } else {
        logger.error("[HealthCheck] database client is null");
        checks.database = "error";
        allOk = false;
      }
    } catch (err) {
      logger.error({ err }, "[HealthCheck] database ping failed");
      checks.database = "error";
      allOk = false;
    }

    // Redis check
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
      allOk = false;
    }

    // Memory check
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    checks.memory = heapUsedMB < heapTotalMB * 0.9 ? "ok" : "error";
    if (checks.memory === "error") allOk = false;

    res.status(allOk ? 200 : 503).json({
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? "1.0.0",
      environment: process.env.NODE_ENV ?? "development",
      checks,
      memory: { heapUsedMB, heapTotalMB },
    });
  });

  // ── Prometheus metrics endpoint ───────────────────────────────────────────
  app.get("/metrics", async (_req, res) => {
    const register = (await import("./metrics")).register;
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  // ── GitHub App webhook endpoint ───────────────────────────────────────────
  app.post("/webhooks/github", express.json(), async (req, res) => {
    const signature = (req.headers["x-hub-signature-256"] as string) || "";
    const result = await handleGitHubWebhook(JSON.stringify(req.body), signature);
    res.status(result.status).json(result.body);
  });

  // ── Inline LLM Gateway service endpoints ──────────────────────────────────
  //
  // These are S2S endpoints called by `gateway/` (the inline LLM proxy).
  // Authenticated via a long-lived bearer token (`GATEWAY_SERVICE_TOKEN`)
  // shared via secret manager. Never exposed to browsers.
  //
  // We mount them inside `/api/internal/*` so any reverse proxy in front of
  // the app can apply mTLS or IP allowlisting at this prefix without
  // touching the public surface.
  function gatewayAuthOk(req: express.Request): boolean {
    const expected = ENV.gatewayServiceToken;
    if (!expected) return false;
    const auth = req.headers.authorization;
    if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return false;
    const presented = auth.slice("Bearer ".length).trim();
    if (presented.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
  }

  app.get("/api/internal/kill-switch/:tenantId", async (req, res) => {
    if (!gatewayAuthOk(req)) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }
    const tenantId = Number.parseInt(req.params.tenantId, 10);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      res.status(400).json({ error: "invalid_tenant_id" });
      return;
    }
    const db = await import("../db");
    const settings = await db.getKillSwitchSettings(tenantId);
    if (!settings) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      isActive: Boolean(settings.isActive),
      currentSpendUSD: Number(settings.currentSpendUSD ?? 0),
      budgetLimitUSD: Number(settings.budgetLimitUSD ?? 0),
    });
  });

  app.post("/api/internal/gateway-audit", express.json(), async (req, res) => {
    if (!gatewayAuthOk(req)) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    // Persist into the cost-meter (tokenUsage) and shadow-AI / runtime
    // monitoring streams so dashboards reflect gateway traffic in real time.
    const audit = body as {
      tenantId?: string;
      requestId?: string;
      model?: string;
      provider?: string;
      decision?: "allowed" | "blocked" | "errored";
      blockReason?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      promptFingerprint?: string;
      startedAt?: number;
      endedAt?: number;
    };
    const db = await import("../db");
    try {
      await db.recordGatewayAudit({
        tenantId: audit.tenantId,
        requestId: audit.requestId,
        model: audit.model,
        provider: audit.provider,
        decision: audit.decision ?? "allowed",
        blockReason: audit.blockReason,
        usage: audit.usage,
        promptFingerprint: audit.promptFingerprint,
        startedAt: audit.startedAt,
        endedAt: audit.endedAt,
      });
    } catch (err) {
      logger.warn({ err }, "[Gateway] audit persist failed");
    }
    logger.info(
      {
        tenantId: audit.tenantId,
        requestId: audit.requestId,
        model: audit.model,
        provider: audit.provider,
        decision: audit.decision,
      },
      "[Gateway] audit record received",
    );
    res.json({ received: true });
  });

  // ── Token-budget query (gateway -> server) ─────────────────────────────────
  // Returns the tenant's quota for the current UTC day plus current usage.
  // Used by the gateway's token-budget policy to enforce hard caps inline.
  app.get("/api/internal/token-budget/:tenantId", async (req, res) => {
    if (!gatewayAuthOk(req)) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }
    const tenantId = Number.parseInt(req.params.tenantId, 10);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      res.status(400).json({ error: "invalid_tenant_id" });
      return;
    }
    const db = await import("../db");
    const budget = await db.getTokenBudgetState(tenantId);
    res.json(budget);
  });

  // ── Shadow AI ingestion (gateway -> server, also accepts agent telemetry) ──
  // Accepts a batch of observed LLM calls from the gateway or from a side-car
  // network probe and runs them through the shadow-AI detector. This is the
  // entry point that lets us surface "rogue LLM API traffic" without an eBPF
  // probe — any sufficiently rich log stream can feed it.
  app.post("/api/internal/shadow-ai-events", express.json({ limit: "1mb" }), async (req, res) => {
    if (!gatewayAuthOk(req)) {
      res.status(401).json({ error: "unauthorised" });
      return;
    }
    const body = req.body as { events?: unknown[] } | undefined;
    if (!body || !Array.isArray(body.events)) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const db = await import("../db");
    const { ingestShadowAiEvents } = await import("../services/shadowAi");
    const summary = await ingestShadowAiEvents(db, body.events);
    res.json(summary);
  });

  // ── Email unsubscribe endpoint ───────────────────────────────────────────
  app.get("/unsubscribe", async (req, res) => {
    const token = req.query.token as string;

    if (!token) {
      res.status(400).send("Missing unsubscribe token");
      return;
    }

    try {
      const db = await import("../db").then((m) => m.getDb());
      if (!db) {
        res.status(500).send("Database not available");
        return;
      }

      const { emailPreferences } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const prefs = await db
        .select()
        .from(emailPreferences)
        .where(eq(emailPreferences.unsubscribeToken, token))
        .limit(1);

      if (prefs.length === 0) {
        res.status(404).send("Invalid unsubscribe token");
        return;
      }

      await db
        .update(emailPreferences)
        .set({
          scanComplete: false,
          budgetAlerts: false,
          weeklyDigest: false,
          teamActivity: false,
        })
        .where(eq(emailPreferences.id, prefs[0].id));

      res.send(`
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Unsubscribed</title></head>
        <body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb;">
          <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <h1 style="color: #16a34a; margin: 0 0 16px;">✓ Unsubscribed</h1>
            <p style="color: #374151; margin: 0;">You've been unsubscribed from all RakshEx emails.</p>
            <a href="${process.env.APP_URL || "https://rakshex.in"}" style="display: inline-block; margin-top: 24px; color: #2563eb; text-decoration: none;">Return to RakshEx</a>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      logger.error({ err: error }, "[Unsubscribe] error");
      res.status(500).send("An error occurred");
    }
  });

  // ── OAuth routes ───────────────────────────────────────────────────────────
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);

  // ── SSO routes (SAML + OIDC login/callback) ──────────────────────────────
  const { registerSsoRoutes } = await import("../sso/routes");
  registerSsoRoutes(app);

  // ── Register optional LLM providers (Anthropic, Bedrock) ────────────────
  const { registerOptionalProviders } = await import("./providers");
  registerOptionalProviders().catch((err) => {
    logger.warn({ err }, "[Providers] Optional provider registration failed");
  });

  // ── Competitor Import routes ───────────────────────────────────────────────
  const { registerImportRoutes } = await import("../api/import");
  registerImportRoutes(app);

  // ── tRPC API ───────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        // Log server-side errors (not client errors like UNAUTHORIZED)
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error(
            { path, message: error.message, stack: error.stack },
            "[tRPC] internal error",
          );
          Sentry.captureException(error);
        }
      },
    }),
  );

  // ── Razorpay Webhook ──────────────────────────────────────────────────────
  app.post(
    "/api/webhooks/razorpay",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["x-razorpay-signature"] as string;
      const webhookSecret = ENV.razorpayWebhookSecret;

      if (!webhookSecret) {
        logger.warn("[Razorpay] Webhook secret not configured — rejecting webhook");
        res.status(500).json({ error: "Webhook not configured" });
        return;
      }

      if (!verifyWebhookSignature(req.body, signature, webhookSecret)) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      try {
        const event = JSON.parse(req.body);

        // Idempotency: Razorpay retries the same event for ~24h until we
        // ack with 2xx. Without dedup, a delayed/dropped response would
        // re-upgrade plans and fire side effects multiple times. We
        // record `evt_*` ids in the `processed_webhook_events` table.
        const eventId = typeof event.id === "string" && event.id.length > 0 ? event.id : null;
        if (eventId) {
          const db = await import("../db");
          const isFirstTime = await db.markWebhookEventProcessed("razorpay", eventId, event.event);
          if (!isFirstTime) {
            logger.info({ eventId, event: event.event }, "[Razorpay] duplicate webhook, skipping");
            res.json({ status: "duplicate", event: event.event });
            return;
          }
        }

        if (event.event === "payment.captured") {
          const paymentEntity = event.payload.payment.entity;
          const notes = paymentEntity.notes || {};
          const userId = parseInt(notes.userId || "0");
          const plan = notes.plan || "pro";

          if (userId > 0) {
            // Import db dynamically to avoid circular deps
            const db = await import("../db");
            await db.updateUserPlan(userId, plan as "pro" | "enterprise");
            logger.info({ userId, plan }, "[Razorpay] payment captured, plan upgraded");
          }

          res.json({ status: "ok" });
        } else if (event.event === "payment.failed") {
          logger.warn(
            { orderId: event.payload.payment.entity.order_id },
            "[Razorpay] payment failed",
          );
          res.json({ status: "ok" });
        } else if (event.event === "subscription.cancelled") {
          const subEntity = event.payload.subscription.entity;
          const notes = subEntity.notes || {};
          const userId = parseInt(notes.userId || "0");

          if (userId > 0) {
            const db = await import("../db");
            await db.updateUserPlan(userId, "free");
            logger.info({ userId }, "[Razorpay] subscription cancelled, plan downgraded to free");
          }

          res.json({ status: "ok" });
        } else {
          res.json({ status: "ignored", event: event.event });
        }
      } catch (error) {
        logger.error({ err: error }, "[Razorpay] webhook processing error");
        res.status(500).json({ error: "Webhook processing failed" });
      }
    },
  );

  // ── Stripe Webhook ────────────────────────────────────────────────────────
  // Stripe is supported as an alternative / addition to the primary Razorpay
  // flow. Mount this handler only if STRIPE_SECRET_KEY and
  // STRIPE_WEBHOOK_SECRET are configured, and skip it if the `stripe`
  // package is not installed in the runtime.
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (stripeSecret && stripeWebhookSecret) {
    try {
      const StripeModule = await import("stripe");
      const Stripe = StripeModule.default;
      const stripe = new Stripe(stripeSecret);

      app.post(
        "/api/webhooks/stripe",
        express.raw({ type: "application/json" }),
        async (req, res) => {
          const sig = req.headers["stripe-signature"] as string | undefined;
          if (!sig) {
            res.status(400).json({ error: "Missing stripe-signature" });
            return;
          }

          let event: import("stripe").Stripe.Event;
          try {
            event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn({ error: msg }, "[Stripe] webhook signature verification failed");
            res.status(400).json({ error: "Invalid signature" });
            return;
          }

          try {
            const dbMod = await import("../db");

            // Idempotency: Stripe replays events on transient errors.
            // Same dedup table as Razorpay; namespaced by provider.
            if (typeof event.id === "string" && event.id.length > 0) {
              const isFirstTime = await dbMod.markWebhookEventProcessed(
                "stripe",
                event.id,
                event.type,
              );
              if (!isFirstTime) {
                logger.info(
                  { eventId: event.id, type: event.type },
                  "[Stripe] duplicate webhook, skipping",
                );
                res.json({ received: true, duplicate: true });
                return;
              }
            }

            switch (event.type) {
              case "checkout.session.completed": {
                const session = event.data.object as import("stripe").Stripe.Checkout.Session;
                const userId = parseInt(session.metadata?.userId ?? "0", 10);
                const plan = (session.metadata?.plan ?? "pro") as "pro" | "enterprise";
                if (userId > 0) {
                  await dbMod.updateUserPlan(userId, plan);
                  logger.info({ userId, plan }, "[Stripe] checkout completed, plan upgraded");
                }
                break;
              }
              case "customer.subscription.deleted": {
                const sub = event.data.object as import("stripe").Stripe.Subscription;
                const userId = parseInt(sub.metadata?.userId ?? "0", 10);
                if (userId > 0) {
                  await dbMod.updateUserPlan(userId, "free");
                  logger.info({ userId }, "[Stripe] subscription deleted, plan downgraded to free");
                }
                break;
              }
              case "invoice.payment_failed": {
                const inv = event.data.object as import("stripe").Stripe.Invoice;
                logger.warn({ invoiceId: inv.id }, "[Stripe] invoice.payment_failed");
                break;
              }
              default:
                // ignore other event types
                break;
            }
            res.json({ received: true, type: event.type });
          } catch (err) {
            logger.error({ err }, "[Stripe] webhook processing error");
            Sentry.captureException(err);
            res.status(500).json({ error: "Webhook processing failed" });
          }
        },
      );
      logger.info("[Stripe] webhook handler mounted at /api/webhooks/stripe");
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : err },
        "[Stripe] `stripe` package not available — skipping webhook mount",
      );
    }
  }

  // ── File Upload for Collections ────────────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
      const allowed = [".json", ".yaml", ".yml"];
      const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf("."));
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${ext}. Only .json, .yaml, .yml are allowed.`));
      }
    },
  });

  app.post("/api/upload/collection", upload.single("file"), async (req, res) => {
    try {
      // Require authentication for file uploads
      let user: any = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        // Not authenticated
      }
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const content = req.file.buffer.toString("utf-8");
      const originalName = req.file.originalname;
      const ext = originalName.toLowerCase().substring(originalName.lastIndexOf("."));

      let format: "postman" | "openapi";
      let data: any;

      if (ext === ".json") {
        try {
          data = JSON.parse(content);
          // Auto-detect format: Postman has "info" with "schema", OpenAPI has "openapi" or "swagger"
          if (data.openapi || data.swagger) {
            format = "openapi";
          } else if (data.info?._postman_id || data.item) {
            format = "postman";
          } else {
            format = "openapi"; // Default to OpenAPI for generic JSON
          }
        } catch {
          res.status(400).json({ error: "Invalid JSON file" });
          return;
        }
      } else {
        // YAML — parse as OpenAPI
        try {
          const yaml = await import("yaml");
          data = yaml.parse(content);
          format = "openapi";
        } catch {
          res.status(400).json({ error: "Invalid YAML file or yaml parser unavailable" });
          return;
        }
      }

      res.json({ format, data, filename: originalName, userId: user.id });
    } catch (error) {
      logger.error({ err: error }, "[Upload] Collection upload error");
      res.status(500).json({ error: "Upload processing failed" });
    }
  });

  // ── Sentry Error Handler ───────────────────────────────────────────────────
  if (ENV.sentryDsn) {
    app.use(Sentry.Handlers.errorHandler());
  }

  // ── WebSocket initialization ─────────────────────────────────────────────────
  wsManager.initialize(server);

  // ── GitHub Webhook ─────────────────────────────────────────────────────────
  app.post("/api/webhooks/github", express.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["x-hub-signature-256"] as string;
    const githubSecret = ENV.githubWebhookSecret || "";

    const body = req.body.toString("utf-8");

    if (githubSecret) {
      const isValid = verifyGitHubWebhook(body, signature, githubSecret);
      if (!isValid) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }

    const event = req.headers["x-github-event"] as string;
    const payload = JSON.parse(body);

    try {
      if (event === "push") {
        const result = handleGitHubPush(payload);
        res.json(result);
      } else if (event === "pull_request") {
        const result = handleGitHubPullRequest(payload);
        res.json(result);
      } else {
        res.json({ status: "ignored", event });
      }
    } catch (error) {
      logger.error({ err: error }, "[GitHub] Webhook processing error");
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ── Frontend serving ───────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Start listening ────────────────────────────────────────────────────────
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn({ preferredPort, port }, "[Server] Preferred port busy, using fallback");
  }

  server.listen(port, () => {
    logger.info(
      {
        port,
        mode: process.env.NODE_ENV ?? "development",
      },
      "[Server] Listening",
    );
    if (!ENV.isProduction) {
      logger.info({ healthUrl: `http://localhost:${port}/api/health` }, "[Server] Health check");
    }

    registerJobWorkers();
    scheduleWeeklyDigest();
    if (process.env.RAKSHEX_REDTEAM_SCHEDULER !== "disabled") {
      startRedTeamScheduler(60_000);
      logger.info("[Server] Continuous red-team scheduler started");
    }
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "[Server] Graceful shutdown initiated");

    const forceShutdownTimeout = setTimeout(() => {
      logger.error("[Server] Forced shutdown triggered after 10s timeout");
      process.exit(1);
    }, 10000);

    try {
      // 1. Close HTTP server accepting new connections
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err) {
            logger.error({ err }, "[Server] Error closing HTTP server");
          } else {
            logger.info("[Server] HTTP server closed");
          }
          resolve();
        });
      });

      // 2. Close database pool
      try {
        const { closeDb } = await import("../db");
        await closeDb();
      } catch (err) {
        logger.error({ err }, "[Server] Error closing DB pool");
      }

      // 3. Close Redis connection
      try {
        await redis.quit();
        logger.info("[Cache] Redis connection closed");
      } catch (err) {
        logger.error({ err }, "[Cache] Error closing Redis connection");
      }

      logger.info("[Server] Graceful shutdown completed");
      clearTimeout(forceShutdownTimeout);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "[Server] Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.fatal({ err }, "[Server] Fatal startup error");
  process.exit(1);
});
