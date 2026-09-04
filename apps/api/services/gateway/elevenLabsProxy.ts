/**
 * ElevenLabs text-to-speech gateway — same auth, kill-switch, budget pool,
 * signed receipts, and attribution path as other enforcement routes.
 */
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { controlPlaneCredentials, providerAccounts } from "@rakshex/database/schema-enterprise";
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";
import * as db from "../../db";
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
const MAX_TEXT_CHARS = 50_000;
/** Conservative ElevenLabs character pricing for preflight reservation (~$0.20/1k chars). */
const USD_PER_CHARACTER = 0.0002;

const ttsSchema = z
  .object({
    text: z.string().min(1).max(MAX_TEXT_CHARS),
    model_id: z.string().max(128).optional(),
    voice_settings: z.record(z.unknown()).optional(),
  })
  .passthrough();

type TtsBody = z.infer<typeof ttsSchema>;

function elevenLabsError(res: Response, status: number, message: string) {
  res.status(status).json({
    detail: { status, message },
  });
}

function workspaceKey(req: Request): string | null {
  const bearer = req.headers.authorization;
  if (typeof bearer === "string" && bearer.startsWith("Bearer ")) {
    const token = bearer.slice("Bearer ".length).trim();
    return token || null;
  }
  const apiKey = req.header("xi-api-key")?.trim();
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

function estimatePreflight(text: string) {
  const characters = text.length;
  return {
    characters,
    estimatedCostUsd: characters * USD_PER_CHARACTER,
  };
}

function characterCountFromHeaders(headers: Headers): number | undefined {
  const raw = headers.get("x-character-count") ?? headers.get("character-count");
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

async function loadElevenLabsConnection(
  workspaceId: number,
  requestedAccountId?: number,
): Promise<{ url: string; apiKey: string; accountId: number }> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");

  const accountConditions = [
    eq(providerAccounts.workspaceId, workspaceId),
    eq(providerAccounts.provider, "elevenlabs"),
  ];
  if (requestedAccountId) accountConditions.push(eq(providerAccounts.id, requestedAccountId));

  const [account] = await database
    .select()
    .from(providerAccounts)
    .where(and(...accountConditions))
    .orderBy(desc(providerAccounts.updatedAt))
    .limit(1);

  if (!account?.adminCredentialId) {
    throw new Error("No centrally managed elevenlabs inference credential is connected");
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

  return { url: "https://api.elevenlabs.io", apiKey, accountId: account.id };
}

async function persistResult(input: {
  auth: ValidatedApiKey;
  requestId: string;
  voiceId: string;
  model?: string;
  identityId?: number;
  projectId?: string;
  agentId?: string;
  tags?: GatewayAttributionTags;
  providerAccountId?: number;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  characters?: number;
  estimatedCostUsd: number;
  startedAt: number;
  chargeEstimated?: boolean;
}): Promise<number> {
  const endedAt = Date.now();
  await db.recordGatewayAudit({
    tenantId: String(input.auth.userId),
    workspaceId: input.auth.workspaceId,
    requestId: input.requestId,
    provider: "elevenlabs",
    model: input.model ?? input.voiceId,
    decision: input.decision,
    blockReason: input.blockReason,
    usage: input.characters
      ? {
          prompt_tokens: input.characters,
          completion_tokens: 0,
          total_tokens: input.characters,
        }
      : undefined,
    startedAt: input.startedAt,
    endedAt,
  });

  const shouldAttribute = input.decision === "allowed" || Boolean(input.chargeEstimated);
  if (!shouldAttribute) return 0;
  if (input.providerAccountId == null) {
    throw new Error("Settled gateway call is missing provider account attribution");
  }

  const characters = input.characters ?? 0;
  const tableFallbackCostUsd = characters > 0 ? characters * USD_PER_CHARACTER : undefined;

  const settlement = await persistSettledAttribution({
    requestId: input.requestId,
    workspaceId: input.auth.workspaceId,
    projectId: input.projectId,
    agentId: input.agentId,
    identityId: input.identityId,
    providerAccountId: input.providerAccountId,
    provider: "elevenlabs",
    model: input.model ?? input.voiceId,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    usageVerified: characters > 0,
    estimatedCostUsd: input.estimatedCostUsd,
    fallbackCostUsd: tableFallbackCostUsd,
    occurredAt: new Date(input.startedAt),
    tags: input.tags ?? {},
    endpoint: "text-to-speech",
  });

  const envelope = normalizeGatewayUsage({
    provider: "elevenlabs",
    product: "tts",
    model: input.model ?? input.voiceId,
    domain: "voice",
    costUsd: settlement.costUsd,
    characters,
    confidence: characters > 0 ? "exact" : "estimated",
  });

  await ingestUsageBatch(input.auth.workspaceId, [
    {
      externalEventId: input.requestId,
      provider: "elevenlabs" as GovernanceProvider,
      providerAccountId: input.providerAccountId,
      source: "gateway",
      product: "tts",
      occurredAt: new Date(input.startedAt),
      requestCount: 1,
      costUsd: settlement.costUsd,
      model: input.model ?? input.voiceId,
      confidence: characters > 0 ? "verified" : "estimated",
      identityId: input.identityId,
      metadata: {
        gateway: true,
        endpoint: "text-to-speech",
        voiceId: input.voiceId,
        characters,
        projectId: input.projectId,
        agentId: input.agentId,
        estimatedCostUsd: input.estimatedCostUsd,
        latencyMs: endedAt - input.startedAt,
        ...usageEnvelopeMetadata(envelope),
      },
    },
  ]);
  return settlement.costUsd;
}

export function registerElevenLabsGatewayRoutes(app: Express): void {
  app.post("/v1/text-to-speech/:voiceId", async (req, res) => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    res.setHeader("x-request-id", requestId);
    res.setHeader("Cache-Control", "no-store");

    const rawKey = workspaceKey(req);
    if (!rawKey) {
      elevenLabsError(res, 401, "A Rakshex workspace API key is required");
      return;
    }

    let auth: ValidatedApiKey | null;
    try {
      auth = await validateWorkspaceApiKey(rawKey, {
        ip: req.ip,
        requiredScope: "gateway:invoke",
      });
    } catch (err) {
      logger.error({ err, requestId }, "[ElevenLabsGateway] API key validation unavailable");
      elevenLabsError(res, 503, "Gateway authentication is unavailable");
      return;
    }
    if (!auth) {
      elevenLabsError(res, 401, "The workspace API key is invalid or lacks gateway:invoke");
      return;
    }

    const appendReceiptOrBlock = async (
      eventType: ActionReceiptEventType,
      payload: Record<string, unknown>,
    ): Promise<boolean> => {
      try {
        await appendActionReceipt({
          workspaceId: auth!.workspaceId,
          requestId,
          eventType,
          occurredAt: new Date(),
          payload,
        });
        return true;
      } catch (err) {
        logger.error(
          { err, requestId, eventType },
          "[ElevenLabsGateway] Receipt ledger unavailable",
        );
        if (!res.headersSent) {
          elevenLabsError(
            res,
            503,
            "Signed receipt ledger is unavailable; request blocked fail-closed",
          );
        } else {
          res.end();
        }
        return false;
      }
    };

    const voiceId = String(req.params.voiceId ?? "").trim();
    if (!voiceId || voiceId.length > 128) {
      if (!(await appendReceiptOrBlock("deny", { reason: "invalid_voice_id" }))) return;
      elevenLabsError(res, 400, "voiceId is required");
      return;
    }

    const parsed = ttsSchema.safeParse(req.body);
    if (!parsed.success) {
      if (!(await appendReceiptOrBlock("deny", { reason: "invalid_request" }))) return;
      elevenLabsError(res, 400, parsed.error.issues[0]?.message ?? "Invalid request");
      return;
    }
    const body = parsed.data;
    const estimate = estimatePreflight(body.text);

    const requestedIdentityId = positiveIntegerHeader(req, "x-rakshex-identity-id");
    if (
      auth.identityId != null &&
      requestedIdentityId != null &&
      auth.identityId !== requestedIdentityId
    ) {
      if (!(await appendReceiptOrBlock("deny", { reason: "identity_scope_mismatch" }))) return;
      elevenLabsError(res, 403, "API key is restricted to another identity");
      return;
    }

    const effectiveIdentityId = auth.identityId ?? requestedIdentityId;
    let identityId: number | undefined;
    try {
      identityId = await resolveWorkspaceIdentityId(
        auth.workspaceId,
        effectiveIdentityId ?? undefined,
      );
    } catch {
      if (!(await appendReceiptOrBlock("deny", { reason: "identity_lookup_unavailable" }))) return;
      elevenLabsError(res, 503, "Governance enforcement is unavailable");
      return;
    }
    if (effectiveIdentityId && identityId == null) {
      if (!(await appendReceiptOrBlock("deny", { reason: "identity_scope_mismatch" }))) return;
      elevenLabsError(res, 403, "Identity does not belong to this workspace");
      return;
    }

    const enforcementIdentityId = auth.identityId != null ? identityId : undefined;
    identityId = enforcementIdentityId;

    const requestedProjectId = safeScopeHeader(req, "x-rakshex-project-id");
    if (auth.projectId && requestedProjectId && auth.projectId !== requestedProjectId) {
      if (!(await appendReceiptOrBlock("deny", { reason: "project_scope_mismatch" }))) return;
      elevenLabsError(res, 403, "API key is restricted to another project");
      return;
    }
    const projectId = auth.projectId ?? undefined;
    const requestedAgentId = safeScopeHeader(req, "x-rakshex-agent-id");
    if (auth.agentId && requestedAgentId && auth.agentId !== requestedAgentId) {
      if (!(await appendReceiptOrBlock("deny", { reason: "agent_scope_mismatch" }))) return;
      elevenLabsError(res, 403, "API key is restricted to another agent");
      return;
    }
    const agentId = auth.agentId ?? undefined;
    const tags = parseGatewayMetadataHeader(req.header("x-rakshex-metadata"));
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
            : "Governance blocked the request");
        await persistResult({
          auth,
          requestId,
          voiceId,
          model: body.model_id,
          identityId,
          projectId,
          agentId,
          tags,
          decision: "blocked",
          blockReason: reason,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        if (!(await appendReceiptOrBlock(governance.killActive ? "kill" : "deny", { reason })))
          return;
        elevenLabsError(res, 403, reason);
        return;
      }

      try {
        await enforcePolicies(
          buildPreflightEventContext({
            model: body.model_id ?? voiceId,
            provider: "elevenlabs",
            estimatedCostUsd: estimate.estimatedCostUsd,
            agentId,
            userId: enforcementIdentityId != null ? String(enforcementIdentityId) : undefined,
            messages: [{ role: "user", content: body.text.slice(0, 512) }],
          }),
          String(auth.workspaceId),
        );
      } catch (err) {
        if (err instanceof RuntimePolicyError) {
          await persistResult({
            auth,
            requestId,
            voiceId,
            model: body.model_id,
            identityId,
            projectId,
            agentId,
            tags,
            decision: "blocked",
            blockReason: err.message,
            estimatedCostUsd: estimate.estimatedCostUsd,
            startedAt,
          });
          if (!(await appendReceiptOrBlock("deny", { reason: err.message }))) return;
          elevenLabsError(res, 403, err.message);
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
          voiceId,
          model: body.model_id,
          identityId,
          projectId,
          agentId,
          tags,
          decision: "blocked",
          blockReason: reservationResult.reason,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        if (!(await appendReceiptOrBlock("deny", { reason: reservationResult.reason }))) return;
        elevenLabsError(res, 403, reservationResult.reason);
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
      logger.error({ err, requestId }, "[ElevenLabsGateway] Enforcement unavailable");
      if (!(await appendReceiptOrBlock("deny", { reason: "enforcement_unavailable" }))) return;
      elevenLabsError(res, 503, "Governance enforcement is unavailable");
      return;
    }

    let connection: { url: string; apiKey: string; accountId: number };
    try {
      connection = await loadElevenLabsConnection(
        auth.workspaceId,
        positiveIntegerHeader(req, "x-rakshex-provider-account-id"),
      );
    } catch (err) {
      await settleGatewayBudget(budgetReservation, 0).catch(() => undefined);
      if (!(await appendReceiptOrBlock("deny", { reason: "provider_not_configured" }))) return;
      elevenLabsError(
        res,
        503,
        err instanceof Error ? err.message : "ElevenLabs provider is not configured",
      );
      return;
    }

    if (
      !(await appendReceiptOrBlock("allow", {
        provider: "elevenlabs",
        voiceId,
        model: body.model_id,
        identityId,
        projectId,
        agentId,
        estimatedCostUsd: estimate.estimatedCostUsd,
        characters: estimate.characters,
      }))
    ) {
      await settleGatewayBudget(budgetReservation, 0).catch(() => undefined);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let providerFetchStarted = false;
    let providerCompleted = false;
    let completedCost = 0;

    try {
      providerFetchStarted = true;
      const upstream = await fetch(
        `${connection.url}/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": connection.apiKey,
            "content-type": "application/json",
            accept: "audio/mpeg",
            "user-agent": "Rakshex-Gateway/1.0",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          redirect: "manual",
        },
      );

      if (!upstream.ok) {
        const upstreamError = (await upstream.text()).slice(0, 8192);
        await persistResult({
          auth,
          requestId,
          voiceId,
          model: body.model_id,
          identityId,
          projectId,
          agentId,
          tags,
          providerAccountId: connection.accountId,
          decision: "errored",
          blockReason: `upstream_${upstream.status}`,
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
        });
        await settleGatewayBudget(budgetReservation, 0);
        if (
          !(await appendReceiptOrBlock("settle", { outcome: "upstream_error", settledCostUsd: 0 }))
        ) {
          return;
        }
        res.status(upstream.status).type("application/json").send(upstreamError);
        return;
      }

      const audio = Buffer.from(await upstream.arrayBuffer());
      const characters = characterCountFromHeaders(upstream.headers) ?? estimate.characters;
      providerCompleted = true;
      completedCost = await persistResult({
        auth,
        requestId,
        voiceId,
        model: body.model_id,
        identityId,
        projectId,
        agentId,
        tags,
        providerAccountId: connection.accountId,
        decision: "allowed",
        characters,
        estimatedCostUsd: estimate.estimatedCostUsd,
        startedAt,
      });
      await settleGatewayBudget(budgetReservation, completedCost);
      if (
        !(await appendReceiptOrBlock("settle", {
          outcome: "completed",
          settledCostUsd: completedCost,
          characters,
        }))
      ) {
        return;
      }
      res.status(200);
      res.setHeader("content-type", upstream.headers.get("content-type") ?? "audio/mpeg");
      res.send(audio);
    } catch (err) {
      const settledCost = settlementCostAfterProviderAttempt({
        providerFetchStarted,
        providerCompleted,
        completedCost,
        estimatedCostUsd: estimate.estimatedCostUsd,
      });
      logger.error({ err, requestId }, "[ElevenLabsGateway] Upstream request failed");
      try {
        await persistResult({
          auth,
          requestId,
          voiceId,
          model: body.model_id,
          identityId,
          projectId,
          agentId,
          tags,
          providerAccountId: connection.accountId,
          decision: "errored",
          blockReason: controller.signal.aborted ? "upstream_timeout" : "upstream_error",
          estimatedCostUsd: estimate.estimatedCostUsd,
          startedAt,
          chargeEstimated: settledCost > 0 && !providerCompleted,
        });
      } catch {
        /* ignore audit failure */
      }
      await settleGatewayBudget(budgetReservation, settledCost).catch(() => undefined);
      if (
        !(await appendReceiptOrBlock("settle", {
          outcome: "upstream_error",
          settledCostUsd: settledCost,
        }))
      ) {
        return;
      }
      if (!res.headersSent) {
        elevenLabsError(
          res,
          controller.signal.aborted ? 504 : 502,
          controller.signal.aborted
            ? "The upstream provider timed out"
            : "The upstream provider request failed",
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  logger.info(
    { failMode: "closed", environment: ENV.nodeEnv },
    "[Gateway] ElevenLabs text-to-speech enforcement route registered",
  );
}
