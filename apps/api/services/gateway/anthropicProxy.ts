/**
 * Anthropic Messages API gateway — same auth, kill-switch, and atomic budget
 * controls as the OpenAI-compatible route. Proxies to Anthropic without
 * exposing the provider API key to the caller.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { controlPlaneCredentials, providerAccounts } from "@rakshex/database/schema-enterprise";
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";
import * as db from "../../db";
import { calculateThinkingCost } from "../thinkingTokens";
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
import { validateWorkspaceApiKey, type ValidatedApiKey } from "../workspaceApiKeys";
import { buildPreflightEventContext, enforcePolicies } from "../../middleware/policyEnforcement";
import { RuntimePolicyError } from "../../_core/errors";
import {
  parseGatewayMetadataHeader,
  persistSettledAttribution,
  type GatewayAttributionTags,
} from "./gatewayAttribution";
import { appendActionReceipt, type ActionReceiptEventType } from "../receipts/actionReceipts";
import { settlementCostAfterProviderAttempt } from "./openAiGatewayCore";
import { normalizeGatewayUsage, usageEnvelopeMetadata } from "./gatewayUsageNormalization";

const UPSTREAM_TIMEOUT_MS = 120_000;
const MAX_UPSTREAM_ERROR_BYTES = 8_192;

const messagesSchema = z
  .object({
    model: z.string().min(1).max(256),
    messages: z.array(z.record(z.unknown())).min(1).max(1_000),
    max_tokens: z.number().int().positive().max(131_072),
    stream: z.boolean().optional().default(false),
    system: z.union([z.string(), z.array(z.record(z.unknown()))]).optional(),
    tools: z.array(z.record(z.unknown())).max(256).optional(),
    temperature: z.number().min(0).max(1).optional(),
  })
  .passthrough();

type MessagesBody = z.infer<typeof messagesSchema>;

function anthropicError(res: Response, status: number, type: string, message: string) {
  res.status(status).json({
    type: "error",
    error: { type, message },
  });
}

function bearerToken(req: Request): string | null {
  const value = req.headers.authorization;
  if (typeof value === "string" && value.startsWith("Bearer ")) {
    const token = value.slice("Bearer ".length).trim();
    return token || null;
  }
  // Anthropic clients often send x-api-key with the Rakshex workspace key.
  const apiKey = req.header("x-api-key")?.trim();
  return apiKey || null;
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

function estimatePreflight(body: MessagesBody) {
  const inputTokens = Math.ceil(JSON.stringify(body.messages).length / 4);
  const outputTokens = body.max_tokens;
  const estimatedTokens = inputTokens + outputTokens;
  const estimatedCostUsd = (estimatedTokens / 1_000_000) * 15;
  return { estimatedTokens, estimatedCostUsd };
}

function extractAnthropicUsage(payload: unknown):
  | {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      cached_input_tokens?: number;
    }
  | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const prompt = Number(record.input_tokens ?? 0);
  const completion = Number(record.output_tokens ?? 0);
  if (![prompt, completion].every(Number.isFinite)) return undefined;
  const cached = Number(record.cache_read_input_tokens ?? 0);
  return {
    prompt_tokens: Math.max(0, prompt),
    completion_tokens: Math.max(0, completion),
    total_tokens: Math.max(0, prompt + completion),
    ...(Number.isFinite(cached) && cached > 0 ? { cached_input_tokens: cached } : {}),
  };
}

async function loadAnthropicConnection(
  workspaceId: number,
  requestedAccountId?: number,
): Promise<{ url: string; apiKey: string; accountId: number }> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");

  const accountConditions = [
    eq(providerAccounts.workspaceId, workspaceId),
    eq(providerAccounts.provider, "anthropic"),
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
    throw new Error("No centrally managed anthropic inference credential is connected");
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
    url: "https://api.anthropic.com/v1/messages",
    apiKey,
    accountId: account.id,
  };
}

async function persistResult(input: {
  auth: ValidatedApiKey;
  requestId: string;
  model: string;
  identityId?: number;
  projectId?: string;
  agentId?: string;
  tags?: GatewayAttributionTags;
  providerAccountId?: number;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_input_tokens?: number;
  };
  estimatedCostUsd: number;
  startedAt: number;
  /** Attribute the preflight estimate when provider work started but usage never arrived. */
  chargeEstimated?: boolean;
}): Promise<number> {
  const endedAt = Date.now();
  await db.recordGatewayAudit({
    tenantId: String(input.auth.userId),
    workspaceId: input.auth.workspaceId,
    requestId: input.requestId,
    provider: "anthropic",
    model: input.model,
    decision: input.decision,
    blockReason: input.blockReason,
    usage: input.usage,
    startedAt: input.startedAt,
    endedAt,
  });
  const shouldAttribute = input.decision === "allowed" || Boolean(input.chargeEstimated);
  if (!shouldAttribute) return 0;
  if (input.providerAccountId == null) {
    throw new Error("Settled gateway call is missing provider account attribution");
  }

  const usage = input.usage;
  const prompt = usage?.prompt_tokens ?? 0;
  const completion = usage?.completion_tokens ?? 0;
  const cached = usage?.cached_input_tokens ?? 0;
  // Deterministic non-registry fallback so Claude models without a versioned
  // registry row still settle at the maintained thinking-token table price.
  const tableFallbackCostUsd = usage
    ? calculateThinkingCost(input.model, prompt, completion, 0).totalCost
    : undefined;

  const settlement = await persistSettledAttribution({
    requestId: input.requestId,
    workspaceId: input.auth.workspaceId,
    projectId: input.projectId,
    agentId: input.agentId,
    identityId: input.identityId,
    providerAccountId: input.providerAccountId,
    provider: "anthropic",
    model: input.model,
    inputTokens: prompt,
    outputTokens: completion,
    cachedInputTokens: cached,
    usageVerified: usage != null,
    estimatedCostUsd: input.estimatedCostUsd,
    fallbackCostUsd: tableFallbackCostUsd,
    occurredAt: new Date(input.startedAt),
    tags: input.tags ?? {},
    endpoint: "messages",
  });

  await ingestUsageBatch(input.auth.workspaceId, [
    {
      externalEventId: input.requestId,
      provider: "anthropic" as GovernanceProvider,
      providerAccountId: input.providerAccountId,
      source: "gateway",
      occurredAt: new Date(input.startedAt),
      requestCount: 1,
      inputTokens: prompt,
      outputTokens: completion,
      costUsd: settlement.costUsd,
      model: input.model,
      confidence: usage ? "verified" : "estimated",
      identityId: input.identityId,
      metadata: {
        gateway: true,
        endpoint: "messages",
        projectId: input.projectId,
        agentId: input.agentId,
        cachedInputTokens: cached,
        estimatedCostUsd: input.estimatedCostUsd,
        priceVersionId: settlement.priceVersionId,
        priceSourceUrl: settlement.priceSourceUrl,
        featureTags: input.tags?.featureTags,
        customerTags: input.tags?.customerTags,
        latencyMs: endedAt - input.startedAt,
        ...usageEnvelopeMetadata(
          normalizeGatewayUsage({
            provider: "anthropic",
            model: input.model,
            costUsd: settlement.costUsd,
            inputTokens: prompt,
            outputTokens: completion,
            confidence: usage ? "exact" : "estimated",
          }),
        ),
      },
    },
  ]);
  return settlement.costUsd;
}

export function registerAnthropicGatewayRoutes(app: Express): void {
  app.post("/v1/messages", async (req, res) => {
    const startedAt = Date.now();
    // Client correlation IDs are untrusted and cannot be uniqueness keys for
    // receipts or settled attribution.
    const requestId = crypto.randomUUID();
    res.setHeader("x-request-id", requestId);
    res.setHeader("Cache-Control", "no-store");

    const rawKey = bearerToken(req);
    if (!rawKey) {
      anthropicError(res, 401, "authentication_error", "A Rakshex workspace API key is required");
      return;
    }

    let auth: ValidatedApiKey | null;
    try {
      auth = await validateWorkspaceApiKey(rawKey, {
        ip: req.ip,
        requiredScope: "gateway:invoke",
      });
    } catch (err) {
      logger.error({ err, requestId }, "[AnthropicGateway] API key validation unavailable");
      anthropicError(res, 503, "api_error", "Gateway authentication is unavailable");
      return;
    }
    if (!auth) {
      anthropicError(
        res,
        401,
        "authentication_error",
        "The workspace API key is invalid or lacks gateway:invoke",
      );
      return;
    }
    const authed = auth;

    // Same signed-receipt contract as the OpenAI core: if the tamper-evident
    // ledger cannot record the decision, the request is blocked fail-closed.
    const appendReceiptOrBlock = async (
      eventType: ActionReceiptEventType,
      payload: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        await appendActionReceipt({
          workspaceId: authed.workspaceId,
          requestId,
          eventType,
          occurredAt: new Date(),
          payload,
        });
        return true;
      } catch (err) {
        logger.error(
          { err, requestId, workspaceId: authed.workspaceId, eventType },
          "[AnthropicGateway] Signed receipt ledger unavailable",
        );
        if (!res.headersSent) {
          anthropicError(
            res,
            503,
            "api_error",
            "Signed receipt ledger is unavailable; request blocked fail-closed",
          );
        } else {
          res.end();
        }
        return false;
      }
    };

    const parsed = messagesSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request";
      if (!(await appendReceiptOrBlock("deny", { reason: "invalid_request", message }))) {
        return;
      }
      anthropicError(res, 400, "invalid_request_error", message);
      return;
    }
    const body = parsed.data;
    if (body.stream) {
      if (
        !(await appendReceiptOrBlock("deny", {
          reason: "streaming_not_supported",
          model: body.model,
        }))
      ) {
        return;
      }
      anthropicError(
        res,
        400,
        "invalid_request_error",
        "Streaming Anthropic responses are not enabled on this gateway yet; omit stream or set stream=false",
      );
      return;
    }

    const requestedIdentityId = positiveIntegerHeader(req, "x-rakshex-identity-id");
    if (
      auth.identityId != null &&
      requestedIdentityId != null &&
      auth.identityId !== requestedIdentityId
    ) {
      if (!(await appendReceiptOrBlock("deny", { reason: "identity_scope_mismatch" }))) {
        return;
      }
      anthropicError(res, 403, "permission_error", "API key is restricted to another identity");
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
      logger.error({ err, requestId }, "[AnthropicGateway] Identity lookup unavailable");
      if (!(await appendReceiptOrBlock("deny", { reason: "identity_lookup_unavailable" }))) {
        return;
      }
      anthropicError(res, 503, "api_error", "Governance enforcement is unavailable");
      return;
    }
    if (effectiveIdentityId && identityId == null) {
      if (
        !(await appendReceiptOrBlock("deny", {
          reason: "identity_scope_mismatch",
          requestedIdentityId: effectiveIdentityId,
        }))
      ) {
        return;
      }
      anthropicError(res, 403, "permission_error", "Identity does not belong to this workspace");
      return;
    }

    // Header scopes remain attribution metadata. Enforcement scope comes only
    // from the validated API key — identical to the OpenAI-compatible core —
    // so same-tenant principals cannot impersonate each other via headers.
    const enforcementIdentityId = auth.identityId != null ? identityId : undefined;
    identityId = enforcementIdentityId;

    const requestedProjectId = safeScopeHeader(req, "x-rakshex-project-id");
    if (auth.projectId && requestedProjectId && auth.projectId !== requestedProjectId) {
      if (!(await appendReceiptOrBlock("deny", { reason: "project_scope_mismatch" }))) {
        return;
      }
      anthropicError(res, 403, "permission_error", "API key is restricted to another project");
      return;
    }
    const projectId = auth.projectId ?? undefined;
    const requestedAgentId = safeScopeHeader(req, "x-rakshex-agent-id");
    if (auth.agentId && requestedAgentId && auth.agentId !== requestedAgentId) {
      if (!(await appendReceiptOrBlock("deny", { reason: "agent_scope_mismatch" }))) {
        return;
      }
      anthropicError(res, 403, "permission_error", "API key is restricted to another agent");
      return;
    }
    const agentId = auth.agentId ?? undefined;
    const tags = parseGatewayMetadataHeader(req.header("x-rakshex-metadata"));
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
        await persistResult({
          auth,
          requestId,
          model: body.model,
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
            provider: "anthropic",
            model: body.model,
            identityId,
            projectId,
            agentId,
            estimatedCostUsd: estimate.estimatedCostUsd,
            reason,
          }))
        ) {
          return;
        }
        anthropicError(res, 403, "permission_error", reason);
        return;
      }

      try {
        await enforcePolicies(
          buildPreflightEventContext({
            model: body.model,
            provider: "anthropic",
            estimatedCostUsd: estimate.estimatedCostUsd,
            agentId,
            userId: auth.identityId != null ? String(auth.identityId) : undefined,
            messages: body.messages,
            tools: body.tools,
          }),
          String(auth.workspaceId),
        );
      } catch (err) {
        if (err instanceof RuntimePolicyError) {
          await persistResult({
            auth,
            requestId,
            model: body.model,
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
              provider: "anthropic",
              model: body.model,
              identityId,
              projectId,
              agentId,
              estimatedCostUsd: estimate.estimatedCostUsd,
              reason: err.message,
            }))
          ) {
            return;
          }
          anthropicError(res, 403, "permission_error", err.message);
          return;
        }
        throw err;
      }

      const reservationResult = await reserveGatewayBudget({
        workspaceId: auth.workspaceId,
        identityId,
        estimatedCostUsd: estimate.estimatedCostUsd,
        requestId,
      });
      if ("reason" in reservationResult) {
        await persistResult({
          auth,
          requestId,
          model: body.model,
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
            provider: "anthropic",
            model: body.model,
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
        anthropicError(res, 403, "permission_error", reservationResult.reason);
        return;
      }
      budgetReservation = reservationResult.reservation;
      if (reservationResult.warning) {
        res.setHeader("x-rakshex-budget-warning", "soft-threshold-exceeded");
        res.setHeader("x-rakshex-budget-used-pct", String(reservationResult.warning.usedPct));
        res.setHeader(
          "x-rakshex-budget-remaining-usd",
          String(reservationResult.warning.remainingUsd),
        );
      }
      if (budgetReservation?.poolPlan?.borrowedUsd) {
        res.setHeader(
          "x-rakshex-pool-borrowed-usd",
          String(budgetReservation.poolPlan.borrowedUsd),
        );
      }
    } catch (err) {
      logger.error({ err, requestId }, "[AnthropicGateway] Enforcement unavailable");
      try {
        await settleGatewayBudget(budgetReservation, 0);
        budgetReservation = null;
      } catch (settleErr) {
        logger.error(
          { err: settleErr, requestId },
          "[AnthropicGateway] Failed to release budget reservation",
        );
      }
      if (!(await appendReceiptOrBlock("deny", { reason: "enforcement_unavailable" }))) {
        return;
      }
      anthropicError(res, 503, "api_error", "Governance enforcement is unavailable");
      return;
    }

    let connection: { url: string; apiKey: string; accountId: number };
    try {
      connection = await loadAnthropicConnection(
        auth.workspaceId,
        positiveIntegerHeader(req, "x-rakshex-provider-account-id"),
      );
    } catch (err) {
      try {
        await settleGatewayBudget(budgetReservation, 0);
        budgetReservation = null;
      } catch {
        /* ignore */
      }
      if (
        !(await appendReceiptOrBlock("deny", {
          provider: "anthropic",
          model: body.model,
          identityId,
          projectId,
          agentId,
          estimatedCostUsd: estimate.estimatedCostUsd,
          reason: "provider_not_configured",
        }))
      ) {
        return;
      }
      anthropicError(
        res,
        503,
        "api_error",
        err instanceof Error ? err.message : "Anthropic provider is not configured",
      );
      return;
    }

    if (
      !(await appendReceiptOrBlock("allow", {
        provider: "anthropic",
        model: body.model,
        identityId,
        projectId,
        agentId,
        estimatedCostUsd: estimate.estimatedCostUsd,
        featureTags: tags.featureTags,
        customerTags: tags.customerTags,
      }))
    ) {
      await settleGatewayBudget(budgetReservation, 0).catch((settleErr) =>
        logger.error(
          { err: settleErr, requestId },
          "[AnthropicGateway] Failed to release budget reservation",
        ),
      );
      budgetReservation = null;
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let providerFetchStarted = false;
    let providerCompleted = false;
    let completedCost = 0;
    try {
      providerFetchStarted = true;
      const upstream = await fetch(connection.url, {
        method: "POST",
        headers: {
          "x-api-key": connection.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "user-agent": "Rakshex-Gateway/1.0",
          "x-request-id": requestId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!upstream.ok) {
        const upstreamError = (await upstream.text()).slice(0, MAX_UPSTREAM_ERROR_BYTES);
        await persistResult({
          auth,
          requestId,
          providerAccountId: connection.accountId,
          model: body.model,
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
            provider: "anthropic",
            providerAccountId: connection.accountId,
            model: body.model,
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

      const payload = await upstream.json();
      const usage = extractAnthropicUsage(payload);
      providerCompleted = true;
      const cost = await persistResult({
        auth,
        requestId,
        providerAccountId: connection.accountId,
        model: body.model,
        identityId,
        projectId,
        agentId,
        tags,
        decision: "allowed",
        usage,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      completedCost = cost;
      await settleGatewayBudget(budgetReservation, cost);
      budgetReservation = null;
      if (
        !(await appendReceiptOrBlock("settle", {
          provider: "anthropic",
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          projectId,
          agentId,
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          cachedInputTokens: usage?.cached_input_tokens ?? 0,
          estimatedCostUsd: estimate.estimatedCostUsd,
          settledCostUsd: cost,
          outcome: "completed",
        }))
      ) {
        return;
      }
      res.status(200).json(payload);
    } catch (err) {
      const aborted = controller.signal.aborted;
      logger.error({ err, requestId }, "[AnthropicGateway] Upstream request failed");
      // Once the credentialed POST has left the gateway, Anthropic may be
      // billing the org credential even if the response was lost, so settle
      // at the conservative estimate until verified usage exists.
      const settledCost = settlementCostAfterProviderAttempt({
        providerFetchStarted,
        providerCompleted,
        completedCost,
        estimatedCostUsd: estimate.estimatedCostUsd,
      });
      try {
        await persistResult({
          auth,
          requestId,
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          projectId,
          agentId,
          tags,
          decision: "errored",
          blockReason: aborted ? "upstream_timeout_or_disconnect" : "upstream_error",
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
          chargeEstimated: settledCost > 0 && !providerCompleted,
        });
      } catch (auditErr) {
        logger.error({ err: auditErr, requestId }, "[AnthropicGateway] Failed to persist audit");
      }
      try {
        await settleGatewayBudget(budgetReservation, settledCost);
        budgetReservation = null;
      } catch {
        /* ignore */
      }
      if (
        !(await appendReceiptOrBlock("settle", {
          provider: "anthropic",
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          projectId,
          agentId,
          settledCostUsd: settledCost,
          outcome: aborted ? "timeout_or_disconnect" : "upstream_error",
          providerCompleted,
          providerFetchStarted,
          billingConfidence:
            providerCompleted || providerFetchStarted
              ? "gateway_settled"
              : "pending_provider_reconciliation",
        }))
      ) {
        return;
      }
      if (!res.headersSent) {
        anthropicError(
          res,
          aborted ? 504 : 502,
          "api_error",
          aborted ? "The upstream provider timed out" : "The upstream provider request failed",
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  logger.info(
    { failMode: "closed", environment: ENV.nodeEnv },
    "[Gateway] Anthropic Messages enforcement route registered",
  );
}
