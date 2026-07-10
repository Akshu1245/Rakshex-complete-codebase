/**
 * Centralized environment variable access with strict Zod validation
 * at startup.
 *
 * Why a Zod schema?
 *
 * The previous implementation only checked "is this string non-empty",
 * which let several real production bugs through:
 *   - `OAUTH_SERVER_URL` with a trailing newline silently broke auth.
 *   - `JWT_SECRET` set to a 4-char placeholder was accepted in prod,
 *     making session tokens trivially forgeable.
 *   - `PORT=80abc` parsed as 80 by `parseInt`, hiding typos until the
 *     server actually tried to bind.
 *
 * Zod gives us URL-shape validation, length checks, and explicit
 * coercion (with a fail-fast error pointing at the offending key)
 * without changing the existing `ENV.cookieSecret` / `ENV.databaseUrl`
 * call sites the rest of the codebase relies on.
 */
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  // Auth / JWT — JWT_SECRET must be unguessable. 32 chars of random
  // hex is the minimum HS256 advisory length. We allow short secrets
  // in dev / test so the suite can boot without a real .env.
  JWT_SECRET: isProduction
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters")
    : z.string().default("dev-secret-do-not-use-in-production"),
  OWNER_OPEN_ID: z.string().default(""),

  // Database — driver accepts mysql:// / mysql2:// / IPv6, so we just
  // require non-empty rather than a strict URL parse. Optional in dev
  // / test so the suite can boot without a real DATABASE_URL.
  DATABASE_URL: isProduction
    ? z.string().min(1, "DATABASE_URL is required")
    : z.string().default(""),

  // Redis (optional — falls back to in-memory caches with a warning)
  REDIS_URL: z.union([z.literal(""), z.string().min(1)]).optional(),

  // OAuth (Manus + Google)
  VITE_APP_ID: z.string().default(""),
  OAUTH_SERVER_URL: z
    .string()
    .url("OAUTH_SERVER_URL must be a valid URL")
    .default("https://auth.manus.app"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),

  // LLM / Forge — both optional, only validated for shape if set.
  BUILT_IN_FORGE_API_URL: z.string().url().default("https://api.manus.app/forge"),
  BUILT_IN_FORGE_API_KEY: z.string().default(""),
  MINIMAX_API_KEY: z.string().default(""),
  MINIMAX_API_URL: z.string().url().default("https://api.minimax.io/v1"),
  MINIMAX_MODEL: z.string().default("minimaxai/minimax-m2.7"),
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_DEFAULT_MODEL: z.string().default("deepseek/deepseek-chat-v3-0324:free"),

  // Email (SMTP)
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("noreply@devpulse.io"),
  APP_URL: z.string().url("APP_URL must be a valid URL").default("http://localhost:3000"),

  // Notifications — empty string allowed, but if set must be a URL.
  SLACK_WEBHOOK_URL: z
    .union([z.literal(""), z.string().url("SLACK_WEBHOOK_URL must be a URL")])
    .default(""),

  // Error monitoring
  SENTRY_DSN: z.union([z.literal(""), z.string().url("SENTRY_DSN must be a URL")]).default(""),

  // Razorpay Payments
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  // Frontend URL — used for OAuth callbacks AND the WebSocket / CORS
  // origin allowlist, so it MUST be a valid URL.
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL").default("http://localhost:3000"),

  GITHUB_WEBHOOK_SECRET: z.string().default(""),
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),
  GITHUB_APP_CLIENT_ID: z.string().default(""),
  GITHUB_APP_CLIENT_SECRET: z.string().default(""),
  INTERNAL_SERVICE_SECRET: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),

  // Inline LLM gateway integration. The gateway calls back to the server's
  // `/api/internal/*` endpoints with `Authorization: Bearer ${TOKEN}`. In
  // production this MUST be set to a long random string and shared with the
  // gateway via a secret manager. Empty in dev disables gateway endpoints.
  GATEWAY_SERVICE_TOKEN: isProduction
    ? z.string().min(32, "GATEWAY_SERVICE_TOKEN must be at least 32 chars in prod").optional()
    : z.string().default(""),

  // Stripe — USD billing rail (Sprint 2 scaffolding). All three are optional
  // because we ship the Stripe code path disabled by default; once the live
  // keys are populated, the checkout endpoints route USD-region buyers
  // through Stripe instead of Razorpay.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── Research & Competitive Intelligence ───────────────────────────────
  TAVILY_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),

  // ── Rakshex Enterprise: Azure ─────────────────────────────────────────
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_SUBSCRIPTION_ID: z.string().optional(),
  AZURE_KEY_VAULT_URL: z.string().optional(),

  // ── Rakshex Enterprise: GitHub Copilot ────────────────────────────────
  GITHUB_ENTERPRISE_SLUG: z.string().optional(),
  GITHUB_COPILOT_TOKEN: z.string().optional(),

  // ── OpenTelemetry ─────────────────────────────────────────────────────
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
});

const parsed = (() => {
  const raw = EnvSchema.safeParse(process.env);
  if (raw.success) return raw.data;

  const issues = raw.error.issues
    .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("\n");

  if (isProduction) {
    console.error("\n❌ ENV validation failed:\n" + issues + "\n");
    process.exit(1);
  }

  console.warn("[ENV] ⚠ schema mismatch (dev mode, continuing):\n" + issues);
  return EnvSchema.parse({});
})();

// Warn if JWT_SECRET uses the insecure dev default
if (!isProduction && parsed.JWT_SECRET === "dev-secret-do-not-use-in-production") {
  console.warn(
    "\n⚠️  SECURITY WARNING: JWT_SECRET is using the default dev value.\n" +
      "   Session tokens are trivially forgeable. Set JWT_SECRET to a\n" +
      "   32+ character random string before deploying to production.\n",
  );
}

export const ENV = {
  cookieSecret: parsed.JWT_SECRET,
  ownerOpenId: parsed.OWNER_OPEN_ID,

  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL ?? "",

  appId: parsed.VITE_APP_ID,
  oAuthServerUrl: parsed.OAUTH_SERVER_URL,
  googleClientId: parsed.GOOGLE_CLIENT_ID,
  googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,

  port: parsed.PORT,
  isProduction,
  nodeEnv: parsed.NODE_ENV,

  forgeApiUrl: parsed.BUILT_IN_FORGE_API_URL,
  forgeApiKey: parsed.BUILT_IN_FORGE_API_KEY,
  minimaxApiKey: parsed.MINIMAX_API_KEY,
  minimaxApiUrl: parsed.MINIMAX_API_URL,
  minimaxModel: parsed.MINIMAX_MODEL,

  smtpHost: parsed.SMTP_HOST,
  smtpPort: parsed.SMTP_PORT,
  smtpUser: parsed.SMTP_USER,
  smtpPass: parsed.SMTP_PASS,
  smtpFrom: parsed.SMTP_FROM,
  appUrl: parsed.APP_URL,

  slackWebhookUrl: parsed.SLACK_WEBHOOK_URL,
  sentryDsn: parsed.SENTRY_DSN,

  razorpayKeyId: parsed.RAZORPAY_KEY_ID,
  razorpayKeySecret: parsed.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: parsed.RAZORPAY_WEBHOOK_SECRET,

  frontendUrl: parsed.FRONTEND_URL,
  githubWebhookSecret: parsed.GITHUB_WEBHOOK_SECRET,
  githubAppId: parsed.GITHUB_APP_ID,
  githubAppPrivateKey: parsed.GITHUB_APP_PRIVATE_KEY,
  githubAppClientId: parsed.GITHUB_APP_CLIENT_ID,
  githubAppClientSecret: parsed.GITHUB_APP_CLIENT_SECRET,
  internalServiceSecret: parsed.INTERNAL_SERVICE_SECRET,
  logLevel: parsed.LOG_LEVEL,
  gatewayServiceToken: parsed.GATEWAY_SERVICE_TOKEN ?? "",

  stripeSecretKey: parsed.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: parsed.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: parsed.STRIPE_WEBHOOK_SECRET ?? "",
  stripeEnabled: Boolean(parsed.STRIPE_SECRET_KEY && parsed.STRIPE_WEBHOOK_SECRET),

  tavilyApiKey: parsed.TAVILY_API_KEY ?? "",
  firecrawlApiKey: parsed.FIRECRAWL_API_KEY ?? "",

  // Azure Enterprise
  azureTenantId: parsed.AZURE_TENANT_ID ?? "",
  azureClientId: parsed.AZURE_CLIENT_ID ?? "",
  azureClientSecret: parsed.AZURE_CLIENT_SECRET ?? "",
  azureSubscriptionId: parsed.AZURE_SUBSCRIPTION_ID ?? "",
  azureKeyVaultUrl: parsed.AZURE_KEY_VAULT_URL ?? "",

  // GitHub Copilot Enterprise
  githubEnterpriseSlug: parsed.GITHUB_ENTERPRISE_SLUG ?? "",
  githubCopilotToken: parsed.GITHUB_COPILOT_TOKEN ?? "",

  // OpenTelemetry
  otelExporterOtlpEndpoint: parsed.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
  otelSampleRate: parsed.OTEL_SAMPLE_RATE,
} as const;

/**
 * Validate critical environment variables at startup.
 * Throws in production if required vars are missing; warns in development.
 */
export function validateEnv(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // CRITICAL — must always be set
  if (!ENV.cookieSecret) errors.push("JWT_SECRET is not set — authentication will not work");
  if (!ENV.databaseUrl) errors.push("DATABASE_URL is not set — database connection will fail");

  // Production-only warnings (not fatal — the app can run without these)
  if (ENV.isProduction) {
    if (!ENV.googleClientId) warnings.push("GOOGLE_CLIENT_ID is not set — OAuth login will fail");
    if (!ENV.googleClientSecret)
      warnings.push("GOOGLE_CLIENT_SECRET is not set — OAuth login will fail");
    if (!ENV.razorpayKeyId) warnings.push("RAZORPAY_KEY_ID is not set — payments will not work");
    if (!ENV.razorpayKeySecret)
      warnings.push("RAZORPAY_KEY_SECRET is not set — payments will not work");
    if (!ENV.razorpayWebhookSecret)
      warnings.push("RAZORPAY_WEBHOOK_SECRET is not set — webhook verification will fail");
    if (!ENV.smtpHost) warnings.push("SMTP_HOST is not set — team invite emails will not be sent");
    if (!ENV.sentryDsn) warnings.push("SENTRY_DSN is not set — error monitoring disabled");
  }

  // Non-critical warnings
  if (!ENV.slackWebhookUrl)
    warnings.push("SLACK_WEBHOOK_URL is not set — kill switch alerts will not be sent to Slack");
  if (!ENV.smtpHost) warnings.push("SMTP_HOST is not set — email features (team invites) disabled");
  if (!ENV.razorpayKeyId) warnings.push("RAZORPAY_KEY_ID is not set — payment features disabled");
  if (!ENV.githubWebhookSecret)
    warnings.push("GITHUB_WEBHOOK_SECRET is not set — GitHub webhook integration disabled");

  // Log warnings
  for (const w of warnings) console.warn(`[ENV] ⚠ ${w}`);

  // In production, throw on errors
  if (ENV.isProduction && errors.length > 0) {
    for (const e of errors) console.error(`[ENV] ✖ ${e}`);
    throw new Error(
      `Missing critical environment variables:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  // In development, just warn
  if (!ENV.isProduction && errors.length > 0) {
    for (const e of errors) console.warn(`[ENV] ⚠ ${e} (would be fatal in production)`);
  }

  return { valid: errors.length === 0, warnings, errors };
}
