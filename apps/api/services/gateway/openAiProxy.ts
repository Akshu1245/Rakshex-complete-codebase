/**
 * OpenAI-compatible, workspace-authenticated inline enforcement gateway.
 *
 * Employees call this endpoint with a Rakshex workspace key. Provider
 * credentials remain encrypted and centrally managed in the control plane.
 * Every request is evaluated before any upstream network call.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { controlPlaneCredentials, providerAccounts } from "@rakshex/database/schema-enterprise";
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { calculateThinkingCost } from "../thinkingTokens";
import { validateWorkspaceApiKey, type ValidatedApiKey } from "../workspaceApiKeys";
import { decryptSecret } from "../vault";
import {
  evaluateGatewayGovernance,
  ingestUsageBatch,
  reserveGatewayBudget,
  resolveWorkspaceIdentityId,
  settleGatewayBudget,
  type GatewayBudgetReservation,
} from "../teamGovernance";
import type { GovernanceProvider } from "../teamGovernance/types";

const MAX_UPSTREAM_ERROR_BYTES = 8_192;
const MAX_STREAM_AUDIT_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120_000;

const chatCompletionSchema = z
  .object({
    model: z.string().min(1).max(256),
    messages: z.array(z.record(z.unknown())).min(1).max(1_000),
    stream: z.boolean().optional().default(false),
    max_tokens: z.number().int().positive().max(131_072).optional(),
    tools: z.array(z.record(z.unknown())).max(256).optional(),
    tool_choice: z.unknown().optional(),
    response_format: z.unknown().optional(),
  })
  .passthrough();

type ChatCompletionBody = z.infer<typeof chatCompletionSchema>;
type SupportedGatewayProvider = "openai" | "openai_compatible";

interface UpstreamConnection {
  provider: SupportedGatewayProvider;
  url: string;
  apiKey: string;
  accountId: number;
}

interface GatewayUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
}

function openAiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  type = "invalid_request_error",
) {
  res.status(status).json({
    error: { message, type, param: null, code },
  });
}

function bearerToken(req: Request): string | null {
  const value = req.headers.authorization;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

function positiveIntegerHeader(req: Request, name: string): number | undefined {
  const raw = req.header(name);
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function safeScopeHeader(req: Request, name: string): string | undefined {
  const raw = req.header(name)?.trim();
  if (!raw) return undefined;
  if (raw.length > 128 || !/^[A-Za-z0-9._:/-]+$/.test(raw)) return undefined;
  return raw;
}

function estimatePreflight(body: ChatCompletionBody): {
  estimatedTokens: number;
  estimatedCostUsd: number;
} {
  const inputTokens = Math.ceil(JSON.stringify(body.messages).length / 4);
  const outputTokens = body.max_tokens ?? 4_096;
  const estimatedTokens = inputTokens + outputTokens;
  // Conservative fallback of $15 / 1M tokens. Preflight estimates are only
  // used for hard gateway budgets; exact provider usage is reconciled later.
  const estimatedCostUsd = (estimatedTokens / 1_000_000) * 15;
  return { estimatedTokens, estimatedCostUsd };
}

function isBlockedUpstreamHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  return (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function normalizeUpstreamUrl(provider: SupportedGatewayProvider, metadata: unknown): string {
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  const record =
    metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const configured = typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
  if (!configured) {
    throw new Error("OpenAI-compatible provider account is missing metadata.baseUrl");
  }
  const parsed = new URL(configured);
  if (parsed.protocol !== "https:" || isBlockedUpstreamHost(parsed.hostname)) {
    throw new Error("OpenAI-compatible base URL must be public HTTPS");
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = path.endsWith("/chat/completions")
    ? path
    : `${path.endsWith("/v1") ? path : `${path}/v1`}/chat/completions`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function loadUpstreamConnection(
  workspaceId: number,
  provider: SupportedGatewayProvider,
  requestedAccountId?: number,
): Promise<UpstreamConnection> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");

  const accountConditions = [
    eq(providerAccounts.workspaceId, workspaceId),
    eq(providerAccounts.provider, provider),
  ];
  if (requestedAccountId) {
    accountConditions.push(eq(providerAccounts.id, requestedAccountId));
  }
  const [account] = await database
    .select()
    .from(providerAccounts)
    .where(and(...accountConditions))
    .orderBy(desc(providerAccounts.updatedAt))
    .limit(1);

  if (!account?.adminCredentialId) {
    throw new Error(`No centrally managed ${provider} inference credential is connected`);
  }

  const [credential] = await database
    .select()
    .from(controlPlaneCredentials)
    .where(
      and(
        eq(controlPlaneCredentials.id, account.adminCredentialId),
        eq(controlPlaneCredentials.workspaceId, workspaceId),
        eq(controlPlaneCredentials.status, "active"),
      ),
    )
    .limit(1);

  if (!credential) throw new Error("Provider credential is missing, expired, or revoked");
  if (credential.expiresAt && credential.expiresAt <= new Date()) {
    throw new Error("Provider credential has expired");
  }
  if (!["api_key", "inference_api_key"].includes(credential.credentialType)) {
    throw new Error("Connected credential is not approved for inference");
  }

  const apiKey = decryptSecret(credential.encryptedValue, `workspace:${workspaceId}`);
  await database
    .update(controlPlaneCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(controlPlaneCredentials.id, credential.id));

  return {
    provider,
    url: normalizeUpstreamUrl(provider, account.metadata),
    apiKey,
    accountId: account.id,
  };
}

function extractUsage(payload: unknown): GatewayUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const prompt = Number(record.prompt_tokens ?? 0);
  const completion = Number(record.completion_tokens ?? 0);
  const total = Number(record.total_tokens ?? prompt + completion);
  if (![prompt, completion, total].every(Number.isFinite)) return undefined;
  const details =
    record.completion_tokens_details && typeof record.completion_tokens_details === "object"
      ? (record.completion_tokens_details as Record<string, unknown>)
      : undefined;
  const reasoning = Number(details?.reasoning_tokens ?? record.reasoning_tokens ?? 0);
  return {
    prompt_tokens: Math.max(0, prompt),
    completion_tokens: Math.max(0, completion),
    total_tokens: Math.max(0, total),
    ...(Number.isFinite(reasoning) && reasoning > 0 ? { reasoning_tokens: reasoning } : {}),
  };
}

function extractStreamingUsage(raw: string): GatewayUsage | undefined {
  let latest: GatewayUsage | undefined;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      latest = extractUsage(JSON.parse(data)) ?? latest;
    } catch {
      // Ignore incomplete/non-JSON provider event lines.
    }
  }
  return latest;
}

function gatewayCost(model: string, usage: GatewayUsage | undefined, estimatedCostUsd: number) {
  if (!usage) return estimatedCostUsd;
  const reasoning = usage.reasoning_tokens ?? 0;
  const prompt = usage.prompt_tokens ?? 0;
  const completion = Math.max(0, usage.completion_tokens - reasoning);
  return calculateThinkingCost(model, prompt, completion, reasoning).totalCost;
}

async function persistGatewayResult(input: {
  auth: ValidatedApiKey;
  requestId: string;
  provider: SupportedGatewayProvider;
  providerAccountId?: number;
  model: string;
  identityId?: number;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  usage?: GatewayUsage;
  estimatedCostUsd: number;
  startedAt: number;
}): Promise<number> {
  const endedAt = Date.now();
  await db.recordGatewayAudit({
    // The legacy gateway audit table is user-scoped; workspaceId is the
    // tenant key for governance. Team usage below is the budget source.
    tenantId: String(input.auth.userId),
    workspaceId: input.auth.workspaceId,
    requestId: input.requestId,
    provider: input.provider,
    model: input.model,
    decision: input.decision,
    blockReason: input.blockReason,
    usage: input.usage,
    startedAt: input.startedAt,
    endedAt,
  });

  if (input.decision !== "allowed") return 0;
  const usage = input.usage;
  const reasoning = usage?.reasoning_tokens ?? 0;
  const prompt = usage?.prompt_tokens ?? 0;
  const completion = Math.max(0, (usage?.completion_tokens ?? 0) - reasoning);
  const cost = gatewayCost(input.model, usage, input.estimatedCostUsd);

  await ingestUsageBatch(input.auth.workspaceId, [
    {
      externalEventId: input.requestId,
      provider: input.provider as GovernanceProvider,
      providerAccountId: input.providerAccountId,
      source: "gateway",
      occurredAt: new Date(input.startedAt),
      requestCount: 1,
      inputTokens: prompt,
      outputTokens: usage?.completion_tokens ?? 0,
      costUsd: cost,
      model: input.model,
      confidence: usage ? "verified" : "estimated",
      identityId: input.identityId,
      metadata: {
        gateway: true,
        latencyMs: endedAt - input.startedAt,
      },
    },
  ]);
  return cost;
}

function providerFromRequest(req: Request): SupportedGatewayProvider | null {
  const provider = (req.header("x-rakshex-provider") ?? "openai").toLowerCase();
  return provider === "openai" || provider === "openai_compatible" ? provider : null;
}

export function registerOpenAiGatewayRoutes(app: Express): void {
  app.post("/v1/chat/completions", async (req, res) => {
    const startedAt = Date.now();
    const requestId = req.header("x-request-id")?.slice(0, 128) || crypto.randomUUID();
    res.setHeader("x-request-id", requestId);
    res.setHeader("Cache-Control", "no-store");

    const rawKey = bearerToken(req);
    if (!rawKey) {
      openAiError(res, 401, "invalid_api_key", "A Rakshex workspace API key is required");
      return;
    }

    let auth: ValidatedApiKey | null;
    try {
      auth = await validateWorkspaceApiKey(rawKey, {
        ip: req.ip,
        requiredScope: "gateway:invoke",
      });
    } catch (err) {
      logger.error({ err, requestId }, "[Gateway] API key validation unavailable");
      openAiError(res, 503, "gateway_auth_unavailable", "Gateway authentication is unavailable");
      return;
    }
    if (!auth) {
      openAiError(
        res,
        401,
        "invalid_api_key",
        "The workspace API key is invalid or lacks gateway:invoke",
      );
      return;
    }

    const parsed = chatCompletionSchema.safeParse(req.body);
    if (!parsed.success) {
      openAiError(
        res,
        400,
        "invalid_request",
        parsed.error.issues[0]?.message ?? "Invalid request",
      );
      return;
    }
    const body = parsed.data;
    const provider = providerFromRequest(req);
    if (!provider) {
      openAiError(
        res,
        400,
        "unsupported_provider",
        "Only openai and openai_compatible are currently supported",
      );
      return;
    }

    const requestedIdentityId = positiveIntegerHeader(req, "x-rakshex-identity-id");
    if (
      auth.identityId != null &&
      requestedIdentityId != null &&
      auth.identityId !== requestedIdentityId
    ) {
      openAiError(
        res,
        403,
        "identity_scope_mismatch",
        "API key is restricted to another identity",
        "policy_error",
      );
      return;
    }
    const effectiveIdentityId = auth.identityId ?? requestedIdentityId;
    let identityId: number | undefined;
    try {
      identityId = await resolveWorkspaceIdentityId(
        auth.workspaceId,
        effectiveIdentityId ?? undefined,
      );
    } catch (err) {
      logger.error(
        { err, requestId, workspaceId: auth.workspaceId },
        "[Gateway] Identity lookup unavailable",
      );
      openAiError(
        res,
        503,
        "enforcement_unavailable",
        "Governance enforcement is unavailable; request blocked fail-closed",
        "policy_error",
      );
      return;
    }
    if (effectiveIdentityId && identityId == null) {
      openAiError(
        res,
        403,
        "identity_scope_mismatch",
        "Identity does not belong to this workspace",
        "policy_error",
      );
      return;
    }
    const requestedProjectId = safeScopeHeader(req, "x-rakshex-project-id");
    if (auth.projectId && requestedProjectId && auth.projectId !== requestedProjectId) {
      openAiError(res, 403, "project_scope_mismatch", "API key is restricted to another project");
      return;
    }
    // Prefer key-bound project; do not let clients expand beyond the key's scope.
    const projectId = auth.projectId ?? requestedProjectId;
    const requestedAgentId = safeScopeHeader(req, "x-rakshex-agent-id");
    if (auth.agentId && requestedAgentId && auth.agentId !== requestedAgentId) {
      openAiError(res, 403, "agent_scope_mismatch", "API key is restricted to another agent");
      return;
    }
    const agentId = auth.agentId ?? requestedAgentId;
    const estimate = estimatePreflight(body);
    let budgetReservation: GatewayBudgetReservation | null = null;

    try {
      const governance = await evaluateGatewayGovernance({
        workspaceId: auth.workspaceId,
        identityId,
        projectId,
        agentId,
        estimatedCostUsd: estimate.estimatedCostUsd,
      });
      if (!governance.allowed) {
        const reason =
          governance.budgetReason ??
          (governance.killActive
            ? "A scoped kill switch is active"
            : "Governance policy blocked the request");
        await persistGatewayResult({
          auth,
          requestId,
          provider,
          model: body.model,
          identityId,
          decision: "blocked",
          blockReason: reason,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        openAiError(res, 403, "rakshex_policy_blocked", reason, "policy_error");
        return;
      }
      const reservationResult = await reserveGatewayBudget({
        workspaceId: auth.workspaceId,
        identityId,
        estimatedCostUsd: estimate.estimatedCostUsd,
      });
      if ("reason" in reservationResult) {
        await persistGatewayResult({
          auth,
          requestId,
          provider,
          model: body.model,
          identityId,
          decision: "blocked",
          blockReason: reservationResult.reason,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        openAiError(res, 403, "rakshex_budget_blocked", reservationResult.reason, "policy_error");
        return;
      }
      budgetReservation = reservationResult.reservation;
    } catch (err) {
      logger.error(
        { err, requestId, workspaceId: auth.workspaceId },
        "[Gateway] Enforcement unavailable",
      );
      openAiError(
        res,
        503,
        "enforcement_unavailable",
        "Governance enforcement is unavailable; request blocked fail-closed",
        "policy_error",
      );
      return;
    }

    let connection: UpstreamConnection;
    try {
      connection = await loadUpstreamConnection(
        auth.workspaceId,
        provider,
        positiveIntegerHeader(req, "x-rakshex-provider-account-id"),
      );
    } catch (err) {
      logger.warn(
        { err, requestId, workspaceId: auth.workspaceId, provider },
        "[Gateway] Provider connection unavailable",
      );
      openAiError(
        res,
        503,
        "provider_not_configured",
        err instanceof Error ? err.message : "Provider is not configured",
      );
      try {
        await settleGatewayBudget(budgetReservation, 0);
        budgetReservation = null;
      } catch (settleErr) {
        logger.error(
          { err: settleErr, requestId },
          "[Gateway] Failed to release budget reservation",
        );
      }
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    req.on("close", () => controller.abort());
    let providerCompleted = false;
    let completedCost = 0;

    try {
      const upstreamBody = body.stream
        ? { ...body, stream_options: { include_usage: true } }
        : body;
      const upstream = await fetch(connection.url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${connection.apiKey}`,
          "content-type": "application/json",
          "user-agent": "Rakshex-Gateway/1.0",
          "x-request-id": requestId,
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });

      if (!upstream.ok) {
        const upstreamError = (await upstream.text()).slice(0, MAX_UPSTREAM_ERROR_BYTES);
        await persistGatewayResult({
          auth,
          requestId,
          provider,
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          decision: "errored",
          blockReason: `upstream_${upstream.status}`,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        await settleGatewayBudget(budgetReservation, 0);
        budgetReservation = null;
        res.status(upstream.status).type("application/json").send(upstreamError);
        return;
      }

      if (!body.stream) {
        const payload = await upstream.json();
        const usage = extractUsage(payload);
        providerCompleted = true;
        completedCost = gatewayCost(body.model, usage, estimate.estimatedCostUsd);
        await persistGatewayResult({
          auth,
          requestId,
          provider,
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          decision: "allowed",
          usage,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        await settleGatewayBudget(budgetReservation, completedCost);
        budgetReservation = null;
        res.status(200).json(payload);
        return;
      }

      if (!upstream.body) throw new Error("Upstream stream body is missing");
      res.status(200);
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "text/event-stream");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let auditBuffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
        if (auditBuffer.length < MAX_STREAM_AUDIT_BYTES) {
          auditBuffer += decoder.decode(value, { stream: true });
        }
      }
      auditBuffer += decoder.decode();
      const usage = extractStreamingUsage(auditBuffer);
      providerCompleted = true;
      completedCost = gatewayCost(body.model, usage, estimate.estimatedCostUsd);
      await persistGatewayResult({
        auth,
        requestId,
        provider,
        providerAccountId: connection.accountId,
        model: body.model,
        identityId,
        decision: "allowed",
        usage,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      await settleGatewayBudget(budgetReservation, completedCost);
      budgetReservation = null;
      res.end();
    } catch (err) {
      const aborted = controller.signal.aborted;
      logger.error(
        { err, requestId, workspaceId: auth.workspaceId, provider },
        "[Gateway] Upstream request failed",
      );
      try {
        await persistGatewayResult({
          auth,
          requestId,
          provider,
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          decision: "errored",
          blockReason: aborted ? "upstream_timeout_or_disconnect" : "upstream_error",
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
      } catch (auditErr) {
        logger.error({ err: auditErr, requestId }, "[Gateway] Failed to persist error audit");
      }
      if (!res.headersSent) {
        openAiError(
          res,
          aborted ? 504 : 502,
          aborted ? "upstream_timeout" : "upstream_error",
          aborted ? "The upstream provider timed out" : "The upstream provider request failed",
        );
      } else {
        res.end();
      }
      try {
        await settleGatewayBudget(budgetReservation, providerCompleted ? completedCost : 0);
        budgetReservation = null;
      } catch (settleErr) {
        logger.error(
          { err: settleErr, requestId },
          "[Gateway] Failed to release budget reservation",
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  logger.info(
    { failMode: "closed", environment: ENV.nodeEnv },
    "[Gateway] OpenAI-compatible enforcement route registered",
  );
}

/** Pure helpers exposed only for focused security/correctness unit tests. */
export const __test = {
  estimatePreflight,
  extractUsage,
  extractStreamingUsage,
  isBlockedUpstreamHost,
  normalizeUpstreamUrl,
};
