/**
 * OpenTelemetry SDK initialization.
 *
 * MUST be imported before any other module that creates spans
 * (Express, tRPC, database drivers, Redis). The OTel SDK patches
 * require instrumentation at startup before module loading.
 *
 * Instrumentation coverage:
 *   - HTTP/HTTPS (incoming Express requests + outgoing fetch/axios)
 *   - PostgreSQL / MySQL (via pg / mysql2 instrumentation)
 *   - Redis (ioredis instrumentation)
 *
 * Export:
 *   - Primary: OTLP HTTP exporter (Sentry-compatible, configurable)
 *   - Fallback: none — if OTEL_EXPORTER_OTLP_ENDPOINT is unset,
 *     tracing is initialized but no data is exported (safe no-op).
 *
 * Sampling:
 *   - OTEL_SAMPLE_RATE env var (0.0–1.0), default 1.0 in dev, 0.1 in prod
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { logger } from "./logger";

const isProduction = process.env.NODE_ENV === "production";
const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const sampleRate = parseFloat(process.env.OTEL_SAMPLE_RATE ?? (isProduction ? "0.1" : "1.0"));

if (isNaN(sampleRate) || sampleRate < 0 || sampleRate > 1) {
  logger.warn(
    { sampleRate: process.env.OTEL_SAMPLE_RATE },
    "[OTel] Invalid OTEL_SAMPLE_RATE, defaulting to 0.1",
  );
}

// Enable debug logging in dev
if (!isProduction && process.env.OTEL_DEBUG === "1") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const traceExporter = otelEndpoint
  ? new OTLPTraceExporter({
      url: otelEndpoint.endsWith("/v1/traces") ? otelEndpoint : `${otelEndpoint}/v1/traces`,
    })
  : undefined;

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy instrumentations in production
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-net": { enabled: false },
      "@opentelemetry/instrumentation-dns": { enabled: false },
    }),
  ],
  resource: resourceFromAttributes({
    "service.name": "rakshex-api",
    "service.version": process.env.npm_package_version ?? "0.1.0",
    "deployment.environment": process.env.NODE_ENV ?? "development",
  }),
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(Math.max(0, Math.min(1, sampleRate))),
  }),
});

// Start the SDK — this patches global modules (http, express, ioredis, etc.)
sdk.start();

logger.info(
  {
    otelEndpoint: otelEndpoint ? otelEndpoint.replace(/\/\/[^@/]*@/, "//***@") : "disabled",
    sampleRate,
    service: "rakshex-api",
  },
  "[OTel] SDK initialized",
);

// Graceful shutdown hook
process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => logger.info("[OTel] SDK shut down"))
    .catch((err) => logger.error({ err }, "[OTel] SDK shutdown failed"));
});

export { sdk as otelSdk };
