/**
 * Centralized environment variable access with strict Zod validation at startup.
 * Production-required secrets and service URLs intentionally have no repository-known
 * defaults: a production process must fail closed when they are absent.
 */
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";
const DEV_JWT_SECRET = "dev-only-jwt-secret-min-32-chars-rakshex";

const requiredString = (name: string) => z.string().min(1, `${name} is required in production`);
const requiredUrl = (name: string) => z.string().url(`${name} must be a valid URL`);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  // Auth / JWT — never fall back to a repository-known value in production.
  JWT_SECRET: isProduction
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters")
    : z.string().min(32, "JWT_SECRET must be at least 32 characters").default(DEV_JWT_SECRET),
  OWNER_OPEN_ID: z.string().default(""),

  // Credential vault root key. Vault operations also fail closed at their call sites;
  // validating here prevents a production API from booting without the root key.
  RAKSHEX_VAULT_KEY: isProduction
    ? z.string().min(32, "RAKSHEX_VAULT_KEY must be at least 32 characters")
    : z.string().default(""),

  // Database / Redis — required for the production control plane.
  DATABASE_URL: isProduction ? requiredString("DATABASE_URL") : z.string().default(""),
  REDIS_URL: isProduction ? requiredString("REDIS_URL") : z.string().default(""),

  // OAuth (legacy Manus auth remains optional; Google/GitHub are optional product paths).
  VITE_APP_ID: z.string().default(""),
  OAUTH_SERVER_URL: z
    .string()
    .url("OAUTH_SERVER_URL must be a valid URL")
    .default("https://auth.manus.app"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),

  // Optional LLM / Forge integrations.
  BUILT_IN_FORGE_API_URL: z.string().url().default("https://api.manus.app/forge"),
  BUILT_IN_FORGE_API_KEY: z.string().default(""),
  MINIMAX_API_KEY: z.string().default(""),
  MINIMAX_API_URL: z.string().url().default("https://api.minimax.io/v1"),
  MINIMAX_MODEL: z.string().default("minimaxai/minimax-m2.7"),
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_DEFAULT_MODEL: z.string().default("deepseek/deepseek-chat-v3-0324:free"),

  // Transactional email is optional during private beta. When SMTP is not configured,
  // email-dependent flows remain unavailable rather than blocking the entire control plane.
  // Do not ship placeholder SMTP credentials just to satisfy startup validation.
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  APP_URL: isProduction
    ? requiredUrl("APP_URL")
    : z.string().url("APP_URL must be a valid URL").default("http://localhost:3001"),

  // Notifications — empty string allowed, but if set must be a URL.
  SLACK_WEBHOOK_URL: z
    .union([z.literal(""), z.string().url("SLACK_WEBHOOK_URL must be a URL")])
    .default(""),

  // Error monitoring.
  SENTRY_DSN: z.union([z.literal(""), z.string().url("SENTRY_DSN must be a URL")]).default(""),

  // Payments are optional until paid plans are enabled.
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  // Frontend URL participates in OAuth callbacks and the CORS allowlist. Require an
  // explicit production origin so self-hosters cannot accidentally boot with our domain.
  FRONTEND_URL: isProduction
    ? requiredUrl("FRONTEND_URL")
    : z.string().url("FRONTEND_URL must be a valid URL").default("http://localhost:3001"),

  // Extra CORS origins are optional; FRONTEND_URL is always included by the allowlist.
  CORS_ORIGINS: z.string().default(""),

  // Protect GET /metrics. No known production bearer token is shipped in source.
  METRICS_TOKEN: isProduction
    ? z.string().min(16, "METRICS_TOKEN must be at least 16 characters")
    : z.string().default(""),

  // GitHub webhook verification must be explicitly configured in production.
  GITHUB_WEBHOOK_SECRET: isProduction
    ? z.string().min(16, "GITHUB_WEBHOOK_SECRET must be at least 16 characters")
    : z.string().default(""),
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_SLUG: z.string().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),
  GITHUB_APP_CLIENT_ID: z.string().default(""),
  GITHUB_APP_CLIENT_SECRET: z.string().default(""),
  INTERNAL_SERVICE_SECRET: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),

  // Inline LLM gateway integration. Empty outside production disables internal gateway
  // callbacks. In production, if configured, it must be a long secret.
  GATEWAY_SERVICE_TOKEN: isProduction
    ? z.string().min(32, "GATEWAY_SERVICE_TOKEN must be at least 32 chars in prod").optional()
    : z.string().default(""),

  // Stripe — optional until the Stripe rail is enabled.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Research & competitive intelligence.
  TAVILY_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),

  // Enterprise Azure.
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_SUBSCRIPTION_ID: z.string().optional(),
  AZURE_KEY_VAULT_URL: z.string().optional(),

  // GitHub Copilot Enterprise.
  GITHUB_ENTERPRISE_SLUG: z.string().optional(),
  GITHUB_COPILOT_TOKEN: z.string().optional(),

  // OpenTelemetry.
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

  console.warn(
    "[ENV] ⚠ schema mismatch (non-production, continuing with safe defaults):\n" + issues,
  );
  return EnvSchema.parse({});
})();

if (!isProduction && parsed.JWT_SECRET === DEV_JWT_SECRET) {
  console.warn(
    "\n⚠️  SECURITY WARNING: JWT_SECRET is using the local-development default.\n" +
      "   Set a unique 32+ character value before sharing or deploying this environment.\n",
  );
}

export const ENV = {
  cookieSecret: parsed.JWT_SECRET,
  ownerOpenId: parsed.OWNER_OPEN_ID,
  vaultKey: parsed.RAKSHEX_VAULT_KEY,

  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,

  appId: parsed.VITE_APP_ID,
  oAuthServerUrl: parsed.OAUTH_SERVER_URL,
  googleClientId: parsed.GOOGLE_CLIENT_ID,
  googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
  githubClientId: parsed.GITHUB_CLIENT_ID || parsed.GITHUB_APP_CLIENT_ID,
  githubClientSecret: parsed.GITHUB_CLIENT_SECRET || parsed.GITHUB_APP_CLIENT_SECRET,

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
  corsOrigins: parsed.CORS_ORIGINS,
  metricsToken: parsed.METRICS_TOKEN,
  githubWebhookSecret: parsed.GITHUB_WEBHOOK_SECRET,
  githubAppId: parsed.GITHUB_APP_ID,
  githubAppSlug: parsed.GITHUB_APP_SLUG,
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

  azureTenantId: parsed.AZURE_TENANT_ID ?? "",
  azureClientId: parsed.AZURE_CLIENT_ID ?? "",
  azureClientSecret: parsed.AZURE_CLIENT_SECRET ?? "",
  azureSubscriptionId: parsed.AZURE_SUBSCRIPTION_ID ?? "",
  azureKeyVaultUrl: parsed.AZURE_KEY_VAULT_URL ?? "",

  githubEnterpriseSlug: parsed.GITHUB_ENTERPRISE_SLUG ?? "",
  githubCopilotToken: parsed.GITHUB_COPILOT_TOKEN ?? "",

  otelExporterOtlpEndpoint: parsed.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
  otelSampleRate: parsed.OTEL_SAMPLE_RATE,
} as const;

/**
 * Validate critical environment variables at startup.
 * The Zod schema already fails production imports for missing required values; these
 * policy checks keep the contract explicit for callers and future refactors.
 */
export function validateEnv(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ENV.cookieSecret) errors.push("JWT_SECRET is not set — authentication will not work");
  if (!ENV.databaseUrl) errors.push("DATABASE_URL is not set — database connection will fail");

  if (ENV.isProduction) {
    if (!ENV.vaultKey)
      errors.push("RAKSHEX_VAULT_KEY is not set — credential vault cannot operate");
    if (!ENV.redisUrl) errors.push("REDIS_URL is not set — required in production (no mock Redis)");
    if (!ENV.smtpHost || !ENV.smtpUser || !ENV.smtpPass || !ENV.smtpFrom) {
      warnings.push("SMTP is not configured — transactional email flows are disabled");
    }
    if (!ENV.metricsToken) {
      errors.push("METRICS_TOKEN is not set — /metrics must not be publicly scrapable");
    }
    if (!ENV.githubWebhookSecret) {
      errors.push("GITHUB_WEBHOOK_SECRET is not set — GitHub webhooks must fail closed");
    }
    if (!ENV.googleClientId) warnings.push("GOOGLE_CLIENT_ID is not set — Google OAuth disabled");
    if (!ENV.googleClientSecret)
      warnings.push("GOOGLE_CLIENT_SECRET is not set — Google OAuth disabled");
    if (!ENV.razorpayKeyId) warnings.push("RAZORPAY_KEY_ID is not set — Razorpay disabled");
    if (!ENV.razorpayKeySecret) warnings.push("RAZORPAY_KEY_SECRET is not set — Razorpay disabled");
    if (!ENV.razorpayWebhookSecret) {
      warnings.push("RAZORPAY_WEBHOOK_SECRET is not set — Razorpay webhooks disabled");
    }
    if (!ENV.sentryDsn) warnings.push("SENTRY_DSN is not set — error monitoring disabled");
  }

  if (!ENV.slackWebhookUrl) {
    warnings.push("SLACK_WEBHOOK_URL is not set — Slack alerts disabled");
  }
  if (!ENV.isProduction && !ENV.smtpHost) {
    warnings.push("SMTP_HOST is not set — email features disabled in this environment");
  }
  if (!ENV.isProduction && !ENV.razorpayKeyId) {
    warnings.push("RAZORPAY_KEY_ID is not set — payment features disabled");
  }
  if (!ENV.isProduction && !ENV.githubWebhookSecret) {
    warnings.push("GITHUB_WEBHOOK_SECRET is not set — GitHub webhook integration disabled");
  }

  for (const warning of warnings) console.warn(`[ENV] ⚠ ${warning}`);

  if (ENV.isProduction && errors.length > 0) {
    for (const error of errors) console.error(`[ENV] ✖ ${error}`);
    throw new Error(
      `Missing critical environment variables:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
    );
  }

  if (!ENV.isProduction && errors.length > 0) {
    for (const error of errors) console.warn(`[ENV] ⚠ ${error} (would be fatal in production)`);
  }

  return { valid: errors.length === 0, warnings, errors };
}
