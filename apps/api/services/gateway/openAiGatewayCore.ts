/**
 * Shared OpenAI-compatible gateway enforcement core.
 *
 * Both Chat Completions and Responses are normalized into this path so auth,
 * identity scoping, kill switches, policy checks, budget reservation,
 * credential mediation, usage attribution, and fail-closed behavior cannot
 * drift between API surfaces.
 */
import crypto from "crypto";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { controlPlaneCredentials, providerAccounts } from "@rakshex/database/schema-enterprise";
import { logger } from "../../_core/logger";
import * as db from "../../db";
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
import { buildPreflightEventContext, enforcePolicies } from "../../middleware/policyEnforcement";
import { RuntimePolicyError } from "../../_core/errors";
import {
  parseGatewayMetadataHeader,
  persistSettledAttribution,
  type GatewayAttributionTags,
} from "./gatewayAttribution";
import { appendActionReceipt, type ActionReceiptEventType } from "../receipts/actionReceipts";

const MAX_UPSTREAM_ERROR_BYTES = 8_192;
const MAX_STREAM_AUDIT_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120_000;
const DEFAULT_PREFLIGHT_OUTPUT_TOKENS = 4_096;
const PREFLIGHT_FALLBACK_USD_PER_MILLION_TOKENS = 15;

export type SupportedGatewayProvider = "openai" | "openai_compatible";
export type OpenAiGatewayEndpoint = "chat/completions" | "responses";

interface UpstreamConnection {
  provider: SupportedGatewayProvider;
  url: string;
  apiKey: string;
  accountId: number;
}

export interface GatewayUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
}

export interface NormalizedOpenAiGatewayRequest {
  endpoint: OpenAiGatewayEndpoint;
  model: string;
  stream: boolean;
  estimatedInput: unknown;
  maxOutputTokens?: number;
  policyMessages?: unknown;
  policyTools?: unknown;
  upstreamBody: Record<string, unknown>;
}

export type OpenAiGatewayNormalizationResult =
  | { ok: true; request: NormalizedOpenAiGatewayRequest }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      type?: string;
    };

export function openAiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  type = "invalid_request_error",
): void {
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

export function estimateGatewayPreflight(
  input: unknown,
  maxOutputTokens = DEFAULT_PREFLIGHT_OUTPUT_TOKENS,
): { estimatedTokens: number; estimatedCostUsd: number } {
  const serialized = JSON.stringify(input) ?? "";
  const inputTokens = Math.ceil(serialized.length / 4);
  const outputTokens = Math.max(1, maxOutputTokens);
  const estimatedTokens = inputTokens + outputTokens;
  // Reservation remains deliberately conservative. Final settlement uses the
  // versioned price registry at the request timestamp.
  const estimatedCostUsd =
    (estimatedTokens / 1_000_000) * PREFLIGHT_FALLBACK_USD_PER_MILLION_TOKENS;
  return { estimatedTokens, estimatedCostUsd };
}

export function isBlockedUpstreamHost(hostname: string): boolean {
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

export function normalizeUpstreamUrl(
  provider: SupportedGatewayProvider,
  metadata: unknown,
  endpoint: OpenAiGatewayEndpoint = "chat/completions",
): string {
  if (provider === "openai") return `https://api.openai.com/v1/${endpoint}`;

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

  let path = parsed.pathname.replace(/\/+$/, "");
  for (const knownEndpoint of ["/chat/completions", "/responses"]) {
    if (path.endsWith(knownEndpoint)) {
      path = path.slice(0, -knownEndpoint.length);
      break;
    }
  }
  if (!path.endsWith("/v1")) path = `${path}/v1`;
  parsed.pathname = `${path}/${endpoint}`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function loadUpstreamConnection(
  workspaceId: number,
  provider: SupportedGatewayProvider,
  endpoint: OpenAiGatewayEndpoint,
  requestedAccountId?: number,
): Promise<UpstreamConnection> {
  if (provider !== "openai") {
    throw new Error("Custom OpenAI-compatible upstreams are disabled in the OpenAI P0 gateway");
  }
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
    url: `https://api.openai.com/v1/${endpoint}`,
    apiKey,
    accountId: account.id,
  };
}

export function extractUsage(payload: unknown): GatewayUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;

  const record = usage as Record<string, unknown>;
  const prompt = Number(record.prompt_tokens ?? record.input_tokens ?? 0);
  const completion = Number(record.completion_tokens ?? record.output_tokens ?? 0);
  const total = Number(record.total_tokens ?? prompt + completion);
  if (![prompt, completion, total].every(Number.isFinite)) return undefined;

  const completionDetails =
    record.completion_tokens_details && typeof record.completion_tokens_details === "object"
      ? (record.completion_tokens_details as Record<string, unknown>)
      : undefined;
  const outputDetails =
    record.output_tokens_details && typeof record.output_tokens_details === "object"
      ? (record.output_tokens_details as Record<string, unknown>)
      : undefined;
  const promptDetails =
    record.prompt_tokens_details && typeof record.prompt_tokens_details === "object"
      ? (record.prompt_tokens_details as Record<string, unknown>)
      : undefined;
  const inputDetails =
    record.input_tokens_details && typeof record.input_tokens_details === "object"
      ? (record.input_tokens_details as Record<string, unknown>)
      : undefined;
  const reasoning = Number(
    completionDetails?.reasoning_tokens ??
      outputDetails?.reasoning_tokens ??
      record.reasoning_tokens ??
      0,
  );
  const cached = Number(promptDetails?.cached_tokens ?? inputDetails?.cached_tokens ?? 0);

  return {
    prompt_tokens: Math.max(0, prompt),
    completion_tokens: Math.max(0, completion),
    total_tokens: Math.max(0, total),
    ...(Number.isFinite(reasoning) && reasoning > 0 ? { reasoning_tokens: reasoning } : {}),
    ...(Number.isFinite(cached) && cached > 0 ? { cached_input_tokens: cached } : {}),
  };
}

export function extractStreamingUsage(raw: string): GatewayUsage | undefined {
  let latest: GatewayUsage | undefined;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as unknown;
      const nestedResponse =
        parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>).response
          : undefined;
      latest = extractUsage(parsed) ?? extractUsage(nestedResponse) ?? latest;
    } catch {
      // Ignore incomplete/non-JSON provider event lines.
    }
  }
  return latest;
}

async function persistGatewayResult(input: {
  auth: ValidatedApiKey;
  requestId: string;
  provider: SupportedGatewayProvider;
  providerAccountId?: number;
  endpoint: OpenAiGatewayEndpoint;
  model: string;
  identityId?: number;
  projectId?: string;
  agentId?: string;
  tags?: GatewayAttributionTags;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  usage?: GatewayUsage;
  estimatedCostUsd: number;
  startedAt: number;
}): Promise<number> {
  const endedAt = Date.now();
  await db.recordGatewayAudit({
    // Audit is written before settled attribution. A successful provider call
    // can therefore never become an unattributed silent action.
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
  if (input.providerAccountId == null) {
    throw new Error("Settled gateway call is missing provider account attribution");
  }

  const usage = input.usage;
  const prompt = usage?.prompt_tokens ?? 0;
  const output = usage?.completion_tokens ?? 0;
  const cached = usage?.cached_input_tokens ?? 0;
  const settlement = await persistSettledAttribution({
    requestId: input.requestId,
    workspaceId: input.auth.workspaceId,
    projectId: input.projectId,
    agentId: input.agentId,
    identityId: input.identityId,
    providerAccountId: input.providerAccountId,
    provider: input.provider,
    model: input.model,
    inputTokens: prompt,
    outputTokens: output,
    cachedInputTokens: cached,
    usageVerified: usage != null,
    estimatedCostUsd: input.estimatedCostUsd,
    occurredAt: new Date(input.startedAt),
    tags: input.tags ?? {},
    endpoint: input.endpoint,
  });

  await ingestUsageBatch(input.auth.workspaceId, [
    {
      externalEventId: input.requestId,
      provider: input.provider as GovernanceProvider,
      providerAccountId: input.providerAccountId,
      source: "gateway",
      occurredAt: new Date(input.startedAt),
      requestCount: 1,
      inputTokens: prompt,
      outputTokens: output,
      costUsd: settlement.costUsd,
      model: input.model,
      confidence: usage ? "verified" : "estimated",
      identityId: input.identityId,
      metadata: {
        gateway: true,
        endpoint: input.endpoint,
        projectId: input.projectId,
        agentId: input.agentId,
        cachedInputTokens: cached,
        estimatedCostUsd: input.estimatedCostUsd,
        priceVersionId: settlement.priceVersionId,
        priceSourceUrl: settlement.priceSourceUrl,
        featureTags: input.tags?.featureTags,
        customerTags: input.tags?.customerTags,
        latencyMs: endedAt - input.startedAt,
      },
    },
  ]);
  return settlement.costUsd;
}

function providerFromRequest(req: Request): SupportedGatewayProvider | null {
  const provider = (req.header("x-rakshex-provider") ?? "openai").toLowerCase();
  // P0 permits only OpenAI's fixed origin. Custom compatible upstreams stay
  // fail-closed until the transport can pin and revalidate a vetted origin.
  return provider === "openai" ? "openai" : null;
}

function appendAuditTail(current: string, chunk: string): string {
  const combined = current + chunk;
  return combined.length <= MAX_STREAM_AUDIT_BYTES
    ? combined
    : combined.slice(combined.length - MAX_STREAM_AUDIT_BYTES);
}

export async function handleOpenAiGatewayRequest(
  req: Request,
  res: Response,
  normalizeRequest: () => OpenAiGatewayNormalizationResult,
): Promise<void> {
  const startedAt = Date.now();
  // Client correlation IDs are untrusted and cannot be uniqueness keys.
  const requestId = crypto.randomUUID();
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

  const appendReceiptOrBlock = async (
    eventType: ActionReceiptEventType,
    payload: Record<string, unknown>,
  ): Promise<boolean> => {
    try {
      await appendActionReceipt({
        workspaceId: auth.workspaceId,
        requestId,
        eventType,
        occurredAt: new Date(),
        payload,
      });
      return true;
    } catch (err) {
      logger.error(
        { err, requestId, workspaceId: auth.workspaceId, eventType },
        "[Gateway] Signed receipt ledger unavailable",
      );
      if (!res.headersSent) {
        openAiError(
          res,
          503,
          "receipt_unavailable",
          "Signed receipt ledger is unavailable; request blocked fail-closed",
          "policy_error",
        );
      } else {
        res.end();
      }
      return false;
    }
  };

  const normalized = normalizeRequest();
  if (!normalized.ok) {
    if (
      !(await appendReceiptOrBlock("deny", {
        reason: normalized.code,
        status: normalized.status,
      }))
    ) {
      return;
    }
    openAiError(
      res,
      normalized.status,
      normalized.code,
      normalized.message,
      normalized.type ?? "invalid_request_error",
    );
    return;
  }
  const request = normalized.request;

  const provider = providerFromRequest(req);
  if (!provider) {
    if (
      !(await appendReceiptOrBlock("deny", {
        reason: "unsupported_provider",
        endpoint: request.endpoint,
        model: request.model,
      }))
    ) {
      return;
    }
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
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        reason: "identity_scope_mismatch",
      }))
    ) {
      return;
    }
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
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        reason: "identity_lookup_unavailable",
      }))
    ) {
      return;
    }
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
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        reason: "identity_scope_mismatch",
        requestedIdentityId: effectiveIdentityId,
      }))
    ) {
      return;
    }
    openAiError(
      res,
      403,
      "identity_scope_mismatch",
      "Identity does not belong to this workspace",
      "policy_error",
    );
    return;
  }

  // Header scopes remain attribution metadata. Enforcement scope comes only
  // from the validated API key, preventing same-tenant principal impersonation.
  const enforcementIdentityId = auth.identityId != null ? identityId : undefined;

  const requestedProjectId = safeScopeHeader(req, "x-rakshex-project-id");
  if (auth.projectId && requestedProjectId && auth.projectId !== requestedProjectId) {
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        reason: "project_scope_mismatch",
      }))
    ) {
      return;
    }
    openAiError(res, 403, "project_scope_mismatch", "API key is restricted to another project");
    return;
  }
  const projectId = auth.projectId ?? requestedProjectId;
  const enforcementProjectId = auth.projectId ?? undefined;

  const requestedAgentId = safeScopeHeader(req, "x-rakshex-agent-id");
  if (auth.agentId && requestedAgentId && auth.agentId !== requestedAgentId) {
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        reason: "agent_scope_mismatch",
      }))
    ) {
      return;
    }
    openAiError(res, 403, "agent_scope_mismatch", "API key is restricted to another agent");
    return;
  }
  const agentId = auth.agentId ?? requestedAgentId;
  const enforcementAgentId = auth.agentId ?? undefined;
  const tags = parseGatewayMetadataHeader(req.header("x-rakshex-metadata"));
  const estimate = estimateGatewayPreflight(request.estimatedInput, request.maxOutputTokens);
  const requestedProviderAccountId = positiveIntegerHeader(req, "x-rakshex-provider-account-id");
  let budgetReservation: GatewayBudgetReservation | null = null;

  try {
    const governance = await evaluateGatewayGovernance({
      workspaceId: auth.workspaceId,
      identityId: enforcementIdentityId,
      projectId: enforcementProjectId,
      agentId: enforcementAgentId,
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
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        tags,
        decision: "blocked",
        blockReason: reason,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      if (
        !(await appendReceiptOrBlock(governance.killActive ? "kill" : "deny", {
          provider,
          endpoint: request.endpoint,
          model: request.model,
          identityId,
          projectId,
          agentId,
          estimatedCostUsd: estimate.estimatedCostUsd,
          reason,
        }))
      ) {
        return;
      }
      openAiError(res, 403, "rakshex_policy_blocked", reason, "policy_error");
      return;
    }

    try {
      await enforcePolicies(
        buildPreflightEventContext({
          model: request.model,
          provider,
          estimatedCostUsd: estimate.estimatedCostUsd,
          agentId: enforcementAgentId,
          userId: enforcementIdentityId != null ? String(enforcementIdentityId) : undefined,
          messages: request.policyMessages,
          tools: request.policyTools,
        }),
        String(auth.workspaceId),
      );
    } catch (err) {
      if (err instanceof RuntimePolicyError) {
        await persistGatewayResult({
          auth,
          requestId,
          provider,
          endpoint: request.endpoint,
          model: request.model,
          identityId,
          projectId,
          agentId,
          tags,
          decision: "blocked",
          blockReason: err.message,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        if (
          !(await appendReceiptOrBlock("deny", {
            provider,
            endpoint: request.endpoint,
            model: request.model,
            identityId,
            projectId,
            agentId,
            estimatedCostUsd: estimate.estimatedCostUsd,
            reason: err.message,
          }))
        ) {
          return;
        }
        openAiError(res, 403, "rakshex_policy_blocked", err.message, "policy_error");
        return;
      }
      throw err;
    }

    const reservationResult = await reserveGatewayBudget({
      workspaceId: auth.workspaceId,
      identityId: enforcementIdentityId,
      estimatedCostUsd: estimate.estimatedCostUsd,
    });
    if ("reason" in reservationResult) {
      await persistGatewayResult({
        auth,
        requestId,
        provider,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        tags,
        decision: "blocked",
        blockReason: reservationResult.reason,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      if (
        !(await appendReceiptOrBlock("deny", {
          provider,
          endpoint: request.endpoint,
          model: request.model,
          identityId,
          projectId,
          agentId,
          estimatedCostUsd: estimate.estimatedCostUsd,
          reason: reservationResult.reason,
          control: "gateway_budget",
        }))
      ) {
        return;
      }
      openAiError(res, 403, "rakshex_budget_blocked", reservationResult.reason, "policy_error");
      return;
    }
    budgetReservation = reservationResult.reservation;

    if (
      !(await appendReceiptOrBlock("allow", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        requestedProviderAccountId,
        estimatedCostUsd: estimate.estimatedCostUsd,
        featureTags: tags.featureTags,
        customerTags: tags.customerTags,
      }))
    ) {
      await settleGatewayBudget(budgetReservation, 0).catch((settleErr) =>
        logger.error(
          { err: settleErr, requestId },
          "[Gateway] Failed to release budget reservation",
        ),
      );
      budgetReservation = null;
      return;
    }
  } catch (err) {
    logger.error(
      { err, requestId, workspaceId: auth.workspaceId },
      "[Gateway] Enforcement unavailable",
    );
    try {
      await settleGatewayBudget(budgetReservation, 0);
      budgetReservation = null;
    } catch (settleErr) {
      logger.error({ err: settleErr, requestId }, "[Gateway] Failed to release budget reservation");
    }
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        estimatedCostUsd: estimate.estimatedCostUsd,
        reason: "enforcement_unavailable",
      }))
    ) {
      return;
    }
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
      request.endpoint,
      requestedProviderAccountId,
    );
  } catch (err) {
    logger.warn(
      { err, requestId, workspaceId: auth.workspaceId, provider },
      "[Gateway] Provider connection unavailable",
    );
    try {
      await settleGatewayBudget(budgetReservation, 0);
      budgetReservation = null;
    } catch (settleErr) {
      logger.error({ err: settleErr, requestId }, "[Gateway] Failed to release budget reservation");
    }
    if (
      !(await appendReceiptOrBlock("deny", {
        provider,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        estimatedCostUsd: estimate.estimatedCostUsd,
        reason: "provider_not_configured",
      }))
    ) {
      return;
    }
    openAiError(
      res,
      503,
      "provider_not_configured",
      err instanceof Error ? err.message : "Provider is not configured",
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  req.on("close", () => controller.abort());
  let providerCompleted = false;
  let completedCost = 0;

  try {
    const upstream = await fetch(connection.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${connection.apiKey}`,
        "content-type": "application/json",
        "user-agent": "Rakshex-Gateway/1.0",
        "x-request-id": requestId,
      },
      body: JSON.stringify(request.upstreamBody),
      signal: controller.signal,
      // Never let a credential-bearing request follow a redirect.
      redirect: "manual",
    });

    if (!upstream.ok) {
      const upstreamError = (await upstream.text()).slice(0, MAX_UPSTREAM_ERROR_BYTES);
      await persistGatewayResult({
        auth,
        requestId,
        provider,
        providerAccountId: connection.accountId,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        tags,
        decision: "errored",
        blockReason: `upstream_${upstream.status}`,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      await settleGatewayBudget(budgetReservation, 0);
      budgetReservation = null;
      if (
        !(await appendReceiptOrBlock("settle", {
          provider,
          providerAccountId: connection.accountId,
          endpoint: request.endpoint,
          model: request.model,
          identityId,
          projectId,
          agentId,
          settledCostUsd: 0,
          outcome: "upstream_error",
          upstreamStatus: upstream.status,
          billingConfidence: "pending_provider_reconciliation",
        }))
      ) {
        return;
      }
      res.status(upstream.status).type("application/json").send(upstreamError);
      return;
    }

    if (!request.stream) {
      const payload = await upstream.json();
      const usage = extractUsage(payload);
      providerCompleted = true;
      completedCost = estimate.estimatedCostUsd;
      completedCost = await persistGatewayResult({
        auth,
        requestId,
        provider,
        providerAccountId: connection.accountId,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        tags,
        decision: "allowed",
        usage,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      await settleGatewayBudget(budgetReservation, completedCost);
      budgetReservation = null;
      if (
        !(await appendReceiptOrBlock("settle", {
          provider,
          providerAccountId: connection.accountId,
          endpoint: request.endpoint,
          model: request.model,
          identityId,
          projectId,
          agentId,
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          cachedInputTokens: usage?.cached_input_tokens ?? 0,
          estimatedCostUsd: estimate.estimatedCostUsd,
          settledCostUsd: completedCost,
          outcome: "completed",
        }))
      ) {
        return;
      }
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
      auditBuffer = appendAuditTail(auditBuffer, decoder.decode(value, { stream: true }));
    }
    auditBuffer = appendAuditTail(auditBuffer, decoder.decode());

    const usage = extractStreamingUsage(auditBuffer);
    providerCompleted = true;
    completedCost = estimate.estimatedCostUsd;
    completedCost = await persistGatewayResult({
      auth,
      requestId,
      provider,
      providerAccountId: connection.accountId,
      endpoint: request.endpoint,
      model: request.model,
      identityId,
      projectId,
      agentId,
      tags,
      decision: "allowed",
      usage,
      estimatedCostUsd: estimate.estimatedCostUsd,
      startedAt,
    });
    await settleGatewayBudget(budgetReservation, completedCost);
    budgetReservation = null;
    if (
      !(await appendReceiptOrBlock("settle", {
        provider,
        providerAccountId: connection.accountId,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        cachedInputTokens: usage?.cached_input_tokens ?? 0,
        estimatedCostUsd: estimate.estimatedCostUsd,
        settledCostUsd: completedCost,
        outcome: "completed",
      }))
    ) {
      return;
    }
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
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        tags,
        decision: "errored",
        blockReason: aborted ? "upstream_timeout_or_disconnect" : "upstream_error",
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
    } catch (auditErr) {
      logger.error({ err: auditErr, requestId }, "[Gateway] Failed to persist error audit");
    }
    try {
      await settleGatewayBudget(budgetReservation, providerCompleted ? completedCost : 0);
      budgetReservation = null;
    } catch (settleErr) {
      logger.error({ err: settleErr, requestId }, "[Gateway] Failed to release budget reservation");
    }
    if (
      !(await appendReceiptOrBlock("settle", {
        provider,
        providerAccountId: connection.accountId,
        endpoint: request.endpoint,
        model: request.model,
        identityId,
        projectId,
        agentId,
        settledCostUsd: providerCompleted ? completedCost : 0,
        outcome: aborted ? "timeout_or_disconnect" : "upstream_error",
        providerCompleted,
        billingConfidence: providerCompleted
          ? "gateway_settled"
          : "pending_provider_reconciliation",
      }))
    ) {
      return;
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
  } finally {
    clearTimeout(timeout);
  }
}
