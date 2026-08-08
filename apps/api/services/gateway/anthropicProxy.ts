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
    }
  | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const prompt = Number(record.input_tokens ?? 0);
  const completion = Number(record.output_tokens ?? 0);
  if (![prompt, completion].every(Number.isFinite)) return undefined;
  return {
    prompt_tokens: Math.max(0, prompt),
    completion_tokens: Math.max(0, completion),
    total_tokens: Math.max(0, prompt + completion),
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
  providerAccountId?: number;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  estimatedCostUsd: number;
  startedAt: number;
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
  if (input.decision !== "allowed") return 0;

  const usage = input.usage;
  const prompt = usage?.prompt_tokens ?? 0;
  const completion = usage?.completion_tokens ?? 0;
  const cost = usage
    ? calculateThinkingCost(input.model, prompt, completion, 0).totalCost
    : input.estimatedCostUsd;

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
      costUsd: cost,
      model: input.model,
      confidence: usage ? "verified" : "estimated",
      identityId: input.identityId,
      metadata: { gateway: true, latencyMs: endedAt - input.startedAt },
    },
  ]);
  return cost;
}

export function registerAnthropicGatewayRoutes(app: Express): void {
  app.post("/v1/messages", async (req, res) => {
    const startedAt = Date.now();
    const requestId = req.header("x-request-id")?.slice(0, 128) || crypto.randomUUID();
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

    const parsed = messagesSchema.safeParse(req.body);
    if (!parsed.success) {
      anthropicError(
        res,
        400,
        "invalid_request_error",
        parsed.error.issues[0]?.message ?? "Invalid request",
      );
      return;
    }
    const body = parsed.data;
    if (body.stream) {
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
      anthropicError(res, 503, "api_error", "Governance enforcement is unavailable");
      return;
    }
    if (effectiveIdentityId && identityId == null) {
      anthropicError(res, 403, "permission_error", "Identity does not belong to this workspace");
      return;
    }

    const requestedProjectId = safeScopeHeader(req, "x-rakshex-project-id");
    if (auth.projectId && requestedProjectId && auth.projectId !== requestedProjectId) {
      anthropicError(res, 403, "permission_error", "API key is restricted to another project");
      return;
    }
    const projectId = auth.projectId ?? requestedProjectId;
    const requestedAgentId = safeScopeHeader(req, "x-rakshex-agent-id");
    if (auth.agentId && requestedAgentId && auth.agentId !== requestedAgentId) {
      anthropicError(res, 403, "permission_error", "API key is restricted to another agent");
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
        await persistResult({
          auth,
          requestId,
          model: body.model,
          identityId,
          decision: "blocked",
          blockReason: reason,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
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
            decision: "blocked",
            blockReason: err.message,
            estimatedCostUsd: estimate.estimatedCostUsd,
            startedAt,
          });
          anthropicError(res, 403, "permission_error", err.message);
          return;
        }
        throw err;
      }

      const reservationResult = await reserveGatewayBudget({
        workspaceId: auth.workspaceId,
        identityId,
        estimatedCostUsd: estimate.estimatedCostUsd,
      });
      if ("reason" in reservationResult) {
        await persistResult({
          auth,
          requestId,
          model: body.model,
          identityId,
          decision: "blocked",
          blockReason: reservationResult.reason,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        anthropicError(res, 403, "permission_error", reservationResult.reason);
        return;
      }
      budgetReservation = reservationResult.reservation;
    } catch (err) {
      logger.error({ err, requestId }, "[AnthropicGateway] Enforcement unavailable");
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
      } catch {
        /* ignore */
      }
      anthropicError(
        res,
        503,
        "api_error",
        err instanceof Error ? err.message : "Anthropic provider is not configured",
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
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

      const payload = await upstream.json();
      const usage = extractAnthropicUsage(payload);
      const cost = await persistResult({
        auth,
        requestId,
        providerAccountId: connection.accountId,
        model: body.model,
        identityId,
        decision: "allowed",
        usage,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      await settleGatewayBudget(budgetReservation, cost);
      budgetReservation = null;
      res.status(200).json(payload);
    } catch (err) {
      const aborted = controller.signal.aborted;
      logger.error({ err, requestId }, "[AnthropicGateway] Upstream request failed");
      try {
        await persistResult({
          auth,
          requestId,
          providerAccountId: connection.accountId,
          model: body.model,
          identityId,
          decision: "errored",
          blockReason: aborted ? "upstream_timeout_or_disconnect" : "upstream_error",
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
      } catch (auditErr) {
        logger.error({ err: auditErr, requestId }, "[AnthropicGateway] Failed to persist audit");
      }
      try {
        await settleGatewayBudget(budgetReservation, 0);
      } catch {
        /* ignore */
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
