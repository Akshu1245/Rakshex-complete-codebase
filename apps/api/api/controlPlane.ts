import { z } from "zod";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { router, protectedProcedure, editorProcedure } from "../_core/trpc";
import * as db from "../db";
import { aiEvents, auditLog, users } from "@rakshex/database";
import {
  aiSubscriptions,
  aiSubscriptionSeats,
  controlPlaneCredentials,
  controlPlaneDiscoveryFindings,
  controlPlaneResources,
  providerAccounts,
} from "@rakshex/database/schema-enterprise";
import { encryptSecret, getVault } from "../services/vault";
import { assertWorkspacePermission } from "../services/workspaceContext";
import { PROVIDERS, type ControlPlaneProvider } from "../services/controlPlane/providerRegistry";
import { sha256 } from "../utils/crypto";
import { evaluateGatewayRequest } from "../services/controlPlane/gatewayPolicy";
import { decideEnforcement, type KillSwitchState } from "../services/gateway/enforcement";
import { readKillSwitchCache } from "../services/gateway/killSwitchCache";
import { detectAgentLoop, createRedisLoopStore } from "../services/agentguard/loopDetector";
import { redis } from "../_core/cache";
import { toNumber } from "../utils/decimal";

const providerIds = [
  "openai",
  "anthropic",
  "azure_openai",
  "bedrock",
  "vertex",
  "github_copilot",
  "claude_teams",
  "cursor",
  "windsurf",
  "ollama",
  "vllm",
  "lm_studio",
  "openai_compatible",
] as const;
const providerSchema = z.enum(providerIds);
const workspaceInput = z.object({ workspaceId: z.number().int().positive() });

async function readAccess(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "policies", "read");
}

async function writeAccess(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "policies", "write");
}

function noDb(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
}

async function validateOpenAiAdminAuthorization(secret: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.openai.com/v1/organization", {
      headers: { authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "OpenAI Admin API authorization failed. Confirm an organization Admin API key was supplied.",
      });
    }
    const payload = (await response.json()) as { id?: unknown; name?: unknown };
    const organizationId = typeof payload.id === "string" ? payload.id : undefined;
    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "OpenAI Admin API authorization returned no organization identifier.",
      });
    }
    return {
      organizationId,
      organizationName: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "OpenAI Admin API could not be reached. No provider credential was stored.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function validateOpenRouterAuthorization(secret: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "OpenRouter authorization failed. Confirm a dedicated OpenRouter API key was supplied.",
      });
    }
    const payload = (await response.json()) as {
      data?: { label?: unknown; limit_remaining?: unknown; usage?: unknown };
    };
    const data = payload.data;
    if (!data || typeof data !== "object") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "OpenRouter authorization returned no key metadata.",
      });
    }
    return {
      keyLabel: typeof data.label === "string" ? data.label : undefined,
      remainingCreditUsd:
        typeof data.limit_remaining === "number" && Number.isFinite(data.limit_remaining)
          ? data.limit_remaining
          : undefined,
    };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "OpenRouter could not be reached. No provider credential was stored.",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const controlPlaneRouter = router({
  providers: router({
    catalog: protectedProcedure.query(() => PROVIDERS),
    accounts: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) return [];
      return database
        .select()
        .from(providerAccounts)
        .where(eq(providerAccounts.workspaceId, input.workspaceId))
        .orderBy(desc(providerAccounts.updatedAt));
    }),
    upsertAccount: editorProcedure
      .input(
        workspaceInput.extend({
          provider: providerSchema,
          accountType: z.string().min(1).max(64),
          externalId: z.string().max(255).optional(),
          displayName: z.string().min(1).max(255),
          authMethod: z
            .enum(["oauth", "admin_api", "scim", "cloud_role", "invoice_import", "manual_import"])
            .default("manual_import"),
          adminCredentialId: z.number().int().positive().optional(),
          metadata: z.record(z.unknown()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const definition = PROVIDERS.find((provider) => provider.id === input.provider)!;
        const [account] = await database!
          .insert(providerAccounts)
          .values({
            workspaceId: input.workspaceId,
            provider: input.provider,
            accountType: input.accountType,
            externalId: input.externalId,
            displayName: input.displayName,
            authMethod: input.authMethod,
            adminCredentialId: input.adminCredentialId,
            capabilities: definition.capabilities as unknown as Record<string, boolean>,
            metadata: input.metadata,
          })
          .returning();
        await db.createAuditLogEntry(ctx.user.id, "provider_account_added", {
          workspaceId: input.workspaceId,
          provider: input.provider,
          accountId: account?.id,
        });
        return account;
      }),
    connectOpenAiGateway: editorProcedure
      .input(
        workspaceInput.extend({
          displayName: z.string().min(1).max(255).default("OpenAI production"),
          credentialName: z.string().min(1).max(128).default("OpenAI gateway inference key"),
          secret: z.string().min(8).max(4096),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();

        const tenant = `workspace:${input.workspaceId}`;
        const vault = getVault();
        const encryptedValue = encryptSecret(input.secret, tenant);
        const fingerprint = vault.fingerprint(input.secret, tenant);
        const definition = PROVIDERS.find((provider) => provider.id === "openai");
        if (!definition) noDb();

        const configured = await database!.transaction(async (tx) => {
          const [existingAccount] = await tx
            .select({
              id: providerAccounts.id,
              adminCredentialId: providerAccounts.adminCredentialId,
            })
            .from(providerAccounts)
            .where(
              and(
                eq(providerAccounts.workspaceId, input.workspaceId),
                eq(providerAccounts.provider, "openai"),
                eq(providerAccounts.accountType, "gateway_inference"),
              ),
            )
            .orderBy(desc(providerAccounts.updatedAt))
            .limit(1)
            .for("update");

          let accountId = existingAccount?.id;
          if (!accountId) {
            const [account] = await tx
              .insert(providerAccounts)
              .values({
                workspaceId: input.workspaceId,
                provider: "openai",
                accountType: "gateway_inference",
                displayName: input.displayName,
                connectionStatus: "configuring",
                authMethod: "manual_import",
                syncStatus: "not_connected",
                capabilities: definition!.capabilities as unknown as Record<string, boolean>,
                metadata: { gatewayPath: "/v1/chat/completions", telemetrySource: "gateway" },
              })
              .returning({ id: providerAccounts.id });
            accountId = account?.id;
          }
          if (!accountId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          const [credential] = await tx
            .insert(controlPlaneCredentials)
            .values({
              workspaceId: input.workspaceId,
              providerAccountId: accountId,
              name: input.credentialName,
              provider: "openai",
              credentialType: "inference_api_key",
              environment: "production",
              encryptedValue,
              fingerprint,
              keyPrefix: input.secret.slice(0, Math.min(12, input.secret.length)),
              createdBy: ctx.user.id,
            })
            .returning({ id: controlPlaneCredentials.id });
          if (!credential?.id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          if (existingAccount?.adminCredentialId) {
            await tx
              .update(controlPlaneCredentials)
              .set({ status: "revoked", revokedAt: new Date() })
              .where(
                and(
                  eq(controlPlaneCredentials.id, existingAccount.adminCredentialId),
                  eq(controlPlaneCredentials.workspaceId, input.workspaceId),
                  eq(controlPlaneCredentials.status, "active"),
                ),
              );
          }

          await tx
            .update(providerAccounts)
            .set({
              displayName: input.displayName,
              connectionStatus: "gateway_enforced",
              authMethod: "manual_import",
              adminCredentialId: credential.id,
              syncStatus: "healthy",
              lastSyncError: null,
              capabilities: definition!.capabilities as unknown as Record<string, boolean>,
              metadata: { gatewayPath: "/v1/chat/completions", telemetrySource: "gateway" },
            })
            .where(eq(providerAccounts.id, accountId));

          return {
            accountId,
            credentialId: credential.id,
            rotated: Boolean(existingAccount?.adminCredentialId),
          };
        });

        await db.createAuditLogEntry(ctx.user.id, "openai_gateway_connected", {
          workspaceId: input.workspaceId,
          providerAccountId: configured.accountId,
          credentialId: configured.credentialId,
          rotatedCredential: configured.rotated,
          enforcement: "routed_traffic_only",
        });

        return {
          ...configured,
          gatewayPath: "/v1/chat/completions",
          enforcement: "routed_traffic_only" as const,
          rawSecretStored: false,
        };
      }),
    connectOpenRouterGateway: editorProcedure
      .input(
        workspaceInput.extend({
          displayName: z.string().min(1).max(255).default("OpenRouter production"),
          credentialName: z.string().min(1).max(128).default("OpenRouter gateway API key"),
          secret: z.string().min(8).max(4096),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const authorization = await validateOpenRouterAuthorization(input.secret);
        const database = await db.getDb();
        if (!database) noDb();

        const tenant = `workspace:${input.workspaceId}`;
        const vault = getVault();
        const encryptedValue = encryptSecret(input.secret, tenant);
        const fingerprint = vault.fingerprint(input.secret, tenant);
        const definition = PROVIDERS.find((provider) => provider.id === "openai_compatible");
        if (!definition) noDb();

        const configured = await database!.transaction(async (tx) => {
          const [existingAccount] = await tx
            .select({
              id: providerAccounts.id,
              adminCredentialId: providerAccounts.adminCredentialId,
            })
            .from(providerAccounts)
            .where(
              and(
                eq(providerAccounts.workspaceId, input.workspaceId),
                eq(providerAccounts.provider, "openai_compatible"),
                eq(providerAccounts.accountType, "gateway_inference"),
              ),
            )
            .orderBy(desc(providerAccounts.updatedAt))
            .limit(1)
            .for("update");

          let accountId = existingAccount?.id;
          if (!accountId) {
            const [account] = await tx
              .insert(providerAccounts)
              .values({
                workspaceId: input.workspaceId,
                provider: "openai_compatible",
                accountType: "gateway_inference",
                displayName: input.displayName,
                connectionStatus: "configuring",
                authMethod: "manual_import",
                syncStatus: "not_connected",
                capabilities: definition!.capabilities as unknown as Record<string, boolean>,
                metadata: {
                  baseUrl: "https://openrouter.ai/api/v1",
                  telemetrySource: "openrouter_key",
                },
              })
              .returning({ id: providerAccounts.id });
            accountId = account?.id;
          }
          if (!accountId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          const [credential] = await tx
            .insert(controlPlaneCredentials)
            .values({
              workspaceId: input.workspaceId,
              providerAccountId: accountId,
              name: input.credentialName,
              provider: "openai_compatible",
              credentialType: "inference_api_key",
              environment: "production",
              encryptedValue,
              fingerprint,
              keyPrefix: input.secret.slice(0, Math.min(12, input.secret.length)),
              createdBy: ctx.user.id,
            })
            .returning({ id: controlPlaneCredentials.id });
          if (!credential?.id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          if (existingAccount?.adminCredentialId) {
            await tx
              .update(controlPlaneCredentials)
              .set({ status: "revoked", revokedAt: new Date() })
              .where(
                and(
                  eq(controlPlaneCredentials.id, existingAccount.adminCredentialId),
                  eq(controlPlaneCredentials.workspaceId, input.workspaceId),
                  eq(controlPlaneCredentials.status, "active"),
                ),
              );
          }

          await tx
            .update(providerAccounts)
            .set({
              displayName: authorization.keyLabel ?? input.displayName,
              connectionStatus: "gateway_enforced",
              authMethod: "manual_import",
              adminCredentialId: credential.id,
              syncStatus: "healthy",
              lastSyncError: null,
              capabilities: definition!.capabilities as unknown as Record<string, boolean>,
              metadata: {
                baseUrl: "https://openrouter.ai/api/v1",
                telemetrySource: "openrouter_key",
                ...(authorization.remainingCreditUsd === undefined
                  ? {}
                  : { providerReportedRemainingCreditUsd: authorization.remainingCreditUsd }),
              },
            })
            .where(eq(providerAccounts.id, accountId));

          return {
            accountId,
            credentialId: credential.id,
            rotated: Boolean(existingAccount?.adminCredentialId),
          };
        });

        await db.createAuditLogEntry(ctx.user.id, "openrouter_gateway_connected", {
          workspaceId: input.workspaceId,
          providerAccountId: configured.accountId,
          credentialId: configured.credentialId,
          rotatedCredential: configured.rotated,
          enforcement: "routed_traffic_only",
        });
        return {
          ...configured,
          gatewayPath: "/v1/chat/completions",
          enforcement: "routed_traffic_only" as const,
          rawSecretStored: false,
        };
      }),
    connectOpenAiAdministration: editorProcedure
      .input(
        workspaceInput.extend({
          displayName: z.string().min(1).max(255).default("OpenAI organization administration"),
          credentialName: z.string().min(1).max(128).default("OpenAI Admin API key"),
          secret: z.string().min(8).max(4096),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const organization = await validateOpenAiAdminAuthorization(input.secret);
        const database = await db.getDb();
        if (!database) noDb();

        const tenant = `workspace:${input.workspaceId}`;
        const vault = getVault();
        const encryptedValue = encryptSecret(input.secret, tenant);
        const fingerprint = vault.fingerprint(input.secret, tenant);
        const definition = PROVIDERS.find((provider) => provider.id === "openai");
        if (!definition) noDb();

        const configured = await database!.transaction(async (tx) => {
          const [existingAccount] = await tx
            .select({
              id: providerAccounts.id,
              adminCredentialId: providerAccounts.adminCredentialId,
            })
            .from(providerAccounts)
            .where(
              and(
                eq(providerAccounts.workspaceId, input.workspaceId),
                eq(providerAccounts.provider, "openai"),
                eq(providerAccounts.accountType, "admin_telemetry"),
              ),
            )
            .orderBy(desc(providerAccounts.updatedAt))
            .limit(1)
            .for("update");

          let accountId = existingAccount?.id;
          if (!accountId) {
            const [account] = await tx
              .insert(providerAccounts)
              .values({
                workspaceId: input.workspaceId,
                provider: "openai",
                accountType: "admin_telemetry",
                externalId: organization.organizationId,
                displayName: input.displayName,
                connectionStatus: "authorizing",
                authMethod: "admin_api",
                syncStatus: "not_connected",
                capabilities: definition!.capabilities as unknown as Record<string, boolean>,
                metadata: { telemetrySource: "openai_admin_api" },
              })
              .returning({ id: providerAccounts.id });
            accountId = account?.id;
          }
          if (!accountId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          const [credential] = await tx
            .insert(controlPlaneCredentials)
            .values({
              workspaceId: input.workspaceId,
              providerAccountId: accountId,
              name: input.credentialName,
              provider: "openai",
              credentialType: "admin_api_key",
              environment: "production",
              encryptedValue,
              fingerprint,
              keyPrefix: input.secret.slice(0, Math.min(12, input.secret.length)),
              createdBy: ctx.user.id,
            })
            .returning({ id: controlPlaneCredentials.id });
          if (!credential?.id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          if (existingAccount?.adminCredentialId) {
            await tx
              .update(controlPlaneCredentials)
              .set({ status: "revoked", revokedAt: new Date() })
              .where(
                and(
                  eq(controlPlaneCredentials.id, existingAccount.adminCredentialId),
                  eq(controlPlaneCredentials.workspaceId, input.workspaceId),
                  eq(controlPlaneCredentials.status, "active"),
                ),
              );
          }

          await tx
            .update(providerAccounts)
            .set({
              externalId: organization.organizationId,
              displayName: organization.organizationName ?? input.displayName,
              connectionStatus: "admin_authorized",
              authMethod: "admin_api",
              adminCredentialId: credential.id,
              syncStatus: "not_connected",
              lastSyncError: "Awaiting first OpenAI administration synchronization",
              capabilities: definition!.capabilities as unknown as Record<string, boolean>,
              metadata: { telemetrySource: "openai_admin_api" },
            })
            .where(eq(providerAccounts.id, accountId));

          return {
            accountId,
            credentialId: credential.id,
            rotated: Boolean(existingAccount?.adminCredentialId),
          };
        });

        await db.createAuditLogEntry(ctx.user.id, "openai_administration_connected", {
          workspaceId: input.workspaceId,
          providerAccountId: configured.accountId,
          credentialId: configured.credentialId,
          organizationId: organization.organizationId,
          rotatedCredential: configured.rotated,
          enforcement: "monitoring_and_provider_native_controls",
        });

        return {
          ...configured,
          organizationId: organization.organizationId,
          enforcement: "monitoring_and_provider_native_controls" as const,
          rawSecretStored: false,
        };
      }),
  }),

  credentials: router({
    list: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) return [];
      return database
        .select({
          id: controlPlaneCredentials.id,
          name: controlPlaneCredentials.name,
          provider: controlPlaneCredentials.provider,
          credentialType: controlPlaneCredentials.credentialType,
          environment: controlPlaneCredentials.environment,
          fingerprint: controlPlaneCredentials.fingerprint,
          keyPrefix: controlPlaneCredentials.keyPrefix,
          status: controlPlaneCredentials.status,
          expiresAt: controlPlaneCredentials.expiresAt,
          lastUsedAt: controlPlaneCredentials.lastUsedAt,
          createdAt: controlPlaneCredentials.createdAt,
        })
        .from(controlPlaneCredentials)
        .where(eq(controlPlaneCredentials.workspaceId, input.workspaceId))
        .orderBy(desc(controlPlaneCredentials.createdAt));
    }),
    create: editorProcedure
      .input(
        workspaceInput.extend({
          provider: providerSchema,
          providerAccountId: z.number().int().positive().optional(),
          name: z.string().min(1).max(128),
          credentialType: z.string().min(1).max(64),
          environment: z.string().min(1).max(32).default("production"),
          secret: z.string().min(8).max(4096),
          expiresAt: z.string().datetime().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const tenant = `workspace:${input.workspaceId}`;
        const vault = getVault();
        const fingerprint = vault.fingerprint(input.secret, tenant);
        const [credential] = await database!
          .insert(controlPlaneCredentials)
          .values({
            workspaceId: input.workspaceId,
            providerAccountId: input.providerAccountId,
            name: input.name,
            provider: input.provider,
            credentialType: input.credentialType,
            environment: input.environment,
            encryptedValue: encryptSecret(input.secret, tenant),
            fingerprint,
            keyPrefix: input.secret.slice(0, Math.min(12, input.secret.length)),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
            createdBy: ctx.user.id,
          })
          .returning({ id: controlPlaneCredentials.id });
        await db.createAuditLogEntry(ctx.user.id, "control_plane_credential_created", {
          workspaceId: input.workspaceId,
          provider: input.provider,
          credentialId: credential?.id,
        });
        return { id: credential?.id, rawSecretStored: false };
      }),
    revoke: editorProcedure
      .input(workspaceInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const [updated] = await database!
          .update(controlPlaneCredentials)
          .set({ status: "revoked", revokedAt: new Date() })
          .where(
            and(
              eq(controlPlaneCredentials.id, input.id),
              eq(controlPlaneCredentials.workspaceId, input.workspaceId),
            ),
          )
          .returning({ id: controlPlaneCredentials.id });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Credential not found" });
        await db.createAuditLogEntry(ctx.user.id, "control_plane_credential_revoked", {
          workspaceId: input.workspaceId,
          credentialId: input.id,
        });
        return { success: true };
      }),
  }),

  subscriptions: router({
    list: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) return [];
      return database
        .select()
        .from(aiSubscriptions)
        .where(eq(aiSubscriptions.workspaceId, input.workspaceId))
        .orderBy(desc(aiSubscriptions.updatedAt));
    }),
    import: editorProcedure
      .input(
        workspaceInput.extend({
          provider: providerSchema,
          plan: z.string().min(1).max(128),
          externalId: z.string().max(255).optional(),
          seatsPurchased: z.number().int().min(0).default(0),
          seatsUsed: z.number().int().min(0).default(0),
          ownerEmail: z.string().email().optional(),
          costCenter: z.string().max(128).optional(),
          renewalAt: z.string().datetime().optional(),
          source: z.enum(["manual", "invoice", "oauth", "admin_api", "scim"]).default("manual"),
          confidence: z.enum(["verified", "imported", "estimated"]).default("imported"),
          metadata: z.record(z.unknown()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const [subscription] = await database!
          .insert(aiSubscriptions)
          .values({
            workspaceId: input.workspaceId,
            provider: input.provider,
            plan: input.plan,
            externalId: input.externalId,
            seatsPurchased: input.seatsPurchased,
            seatsUsed: input.seatsUsed,
            ownerEmail: input.ownerEmail,
            costCenter: input.costCenter,
            renewalAt: input.renewalAt ? new Date(input.renewalAt) : undefined,
            source: input.source,
            confidence: input.confidence,
            metadata: input.metadata,
          })
          .returning();
        await db.createAuditLogEntry(ctx.user.id, "ai_subscription_imported", {
          workspaceId: input.workspaceId,
          provider: input.provider,
          subscriptionId: subscription?.id,
          confidence: input.confidence,
        });
        return subscription;
      }),
    seats: protectedProcedure
      .input(workspaceInput.extend({ subscriptionId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        await readAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) return [];
        return database
          .select()
          .from(aiSubscriptionSeats)
          .where(
            and(
              eq(aiSubscriptionSeats.workspaceId, input.workspaceId),
              eq(aiSubscriptionSeats.subscriptionId, input.subscriptionId),
            ),
          )
          .orderBy(desc(aiSubscriptionSeats.updatedAt));
      }),
    importSeats: editorProcedure
      .input(
        workspaceInput.extend({
          subscriptionId: z.number().int().positive(),
          seats: z
            .array(
              z.object({
                externalUserId: z.string().max(255).optional(),
                email: z.string().email().optional(),
                displayName: z.string().max(255).optional(),
                role: z.string().max(64).optional(),
                status: z.string().max(32).default("active"),
                assignedAt: z.string().datetime().optional(),
                lastActivityAt: z.string().datetime().optional(),
                source: z
                  .enum(["manual", "oauth", "admin_api", "scim", "invoice"])
                  .default("manual"),
                confidence: z
                  .enum(["verified", "imported", "estimated", "inferred"])
                  .default("imported"),
                metadata: z.record(z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(10000),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const rows = input.seats.map((seat) => ({
          workspaceId: input.workspaceId,
          subscriptionId: input.subscriptionId,
          ...seat,
          assignedAt: seat.assignedAt ? new Date(seat.assignedAt) : undefined,
          lastActivityAt: seat.lastActivityAt ? new Date(seat.lastActivityAt) : undefined,
        }));
        const inserted = await database!
          .insert(aiSubscriptionSeats)
          .values(rows)
          .returning({ id: aiSubscriptionSeats.id });
        await db.createAuditLogEntry(ctx.user.id, "ai_subscription_seats_imported", {
          workspaceId: input.workspaceId,
          subscriptionId: input.subscriptionId,
          count: inserted.length,
        });
        return { accepted: inserted.length };
      }),
  }),

  resources: router({
    list: protectedProcedure
      .input(
        workspaceInput.extend({
          provider: providerSchema.optional(),
          resourceType: z.string().max(64).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        await readAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) return [];
        const filters = [eq(controlPlaneResources.workspaceId, input.workspaceId)];
        if (input.provider) filters.push(eq(controlPlaneResources.provider, input.provider));
        if (input.resourceType)
          filters.push(eq(controlPlaneResources.resourceType, input.resourceType));
        return database
          .select()
          .from(controlPlaneResources)
          .where(and(...filters))
          .orderBy(desc(controlPlaneResources.updatedAt))
          .limit(2000);
      }),
    upsert: editorProcedure
      .input(
        workspaceInput.extend({
          provider: providerSchema,
          providerAccountId: z.number().int().positive().optional(),
          resourceType: z.string().min(1).max(64),
          externalId: z.string().min(1).max(512),
          parentExternalId: z.string().max(512).optional(),
          displayName: z.string().min(1).max(255),
          region: z.string().max(64).optional(),
          ownerEmail: z.string().email().optional(),
          costCenter: z.string().max(128).optional(),
          tags: z.record(z.string()).optional(),
          source: z.enum(["manual", "oauth", "admin_api", "invoice", "scim"]).default("manual"),
          confidence: z.enum(["verified", "imported", "estimated", "inferred"]).default("imported"),
          metadata: z.record(z.unknown()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const [resource] = await database!
          .insert(controlPlaneResources)
          .values({
            workspaceId: input.workspaceId,
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            resourceType: input.resourceType,
            externalId: input.externalId,
            parentExternalId: input.parentExternalId,
            displayName: input.displayName,
            region: input.region,
            ownerEmail: input.ownerEmail,
            costCenter: input.costCenter,
            tags: input.tags,
            source: input.source,
            confidence: input.confidence,
            metadata: input.metadata,
          })
          .returning();
        return resource;
      }),
  }),

  discovery: router({
    list: protectedProcedure
      .input(
        workspaceInput.extend({
          status: z.enum(["open", "acknowledged", "remediated"]).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        await readAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) return [];
        const condition = input.status
          ? and(
              eq(controlPlaneDiscoveryFindings.workspaceId, input.workspaceId),
              eq(controlPlaneDiscoveryFindings.status, input.status),
            )
          : eq(controlPlaneDiscoveryFindings.workspaceId, input.workspaceId);
        return database
          .select()
          .from(controlPlaneDiscoveryFindings)
          .where(condition)
          .orderBy(desc(controlPlaneDiscoveryFindings.createdAt))
          .limit(500);
      }),
    ingestMasked: editorProcedure
      .input(
        workspaceInput.extend({
          source: z.string().min(1).max(64),
          findings: z
            .array(
              z.object({
                kind: z.string().min(1).max(64),
                provider: providerSchema.optional(),
                fingerprint: z.string().min(16).max(128),
                maskedValue: z.string().max(128).optional(),
                sourcePath: z.string().max(512).optional(),
                model: z.string().max(128).optional(),
                severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
                metadata: z.record(z.unknown()).optional(),
              }),
            )
            .min(1)
            .max(500),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const rows = input.findings.map((finding) => ({
          workspaceId: input.workspaceId,
          kind: finding.kind,
          provider: finding.provider as ControlPlaneProvider | undefined,
          fingerprint: finding.fingerprint,
          maskedValue: finding.maskedValue,
          source: input.source,
          sourcePath: finding.sourcePath,
          model: finding.model,
          severity: finding.severity,
          metadata: finding.metadata,
        }));
        const inserted = await database!
          .insert(controlPlaneDiscoveryFindings)
          .values(rows)
          .returning({ id: controlPlaneDiscoveryFindings.id });
        return { accepted: inserted.length, rawContentStored: false };
      }),
  }),

  usage: router({
    record: protectedProcedure
      .input(
        workspaceInput.extend({
          agentId: z.string().min(1).max(128),
          provider: z.string().min(1).max(64),
          model: z.string().min(1).max(128),
          latencyMs: z.number().int().min(0),
          inputTokens: z.number().int().min(0).default(0),
          outputTokens: z.number().int().min(0).default(0),
          costUsd: z.number().min(0).default(0),
          status: z.enum(["ok", "error", "timeout", "blocked"]).default("ok"),
          promptHash: z.string().length(64).optional(),
          responseHash: z.string().length(64).optional(),
          metadata: z.record(z.unknown()).default({}),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await writeAccess(input.workspaceId, ctx.user.id);
        const database = await db.getDb();
        if (!database) noDb();
        const eventId = crypto.randomUUID();
        await database!.insert(aiEvents).values({
          eventId,
          userId: ctx.user.id,
          workspaceId: String(input.workspaceId),
          agentId: input.agentId,
          provider: input.provider,
          model: input.model,
          requestTimestamp: new Date(),
          latencyMs: input.latencyMs,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          cachedTokens: 0,
          costUsd: String(input.costUsd),
          status: input.status,
          redactionCount: 0,
          promptHash: input.promptHash ?? sha256("redacted"),
          responseHash: input.responseHash ?? sha256("redacted"),
          metadata: input.metadata,
        });
        return { eventId, rawPromptStored: false };
      }),
    summary: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database)
        return { totalCostUsd: 0, totalRequests: 0, totalTokens: 0, byUser: [], byModel: [] };
      const events = await database
        .select({
          userId: aiEvents.userId,
          userName: users.name,
          userEmail: users.email,
          provider: aiEvents.provider,
          model: aiEvents.model,
          inputTokens: aiEvents.inputTokens,
          outputTokens: aiEvents.outputTokens,
          costUsd: aiEvents.costUsd,
        })
        .from(aiEvents)
        .leftJoin(users, eq(aiEvents.userId, users.id))
        .where(eq(aiEvents.workspaceId, String(input.workspaceId)))
        .orderBy(desc(aiEvents.requestTimestamp))
        .limit(5000);

      const usersById = new Map<
        number,
        {
          userId: number;
          name: string | null;
          email: string | null;
          requests: number;
          tokens: number;
          costUsd: number;
        }
      >();
      const modelsById = new Map<
        string,
        { provider: string; model: string; requests: number; tokens: number; costUsd: number }
      >();
      let totalCostUsd = 0;
      let totalTokens = 0;
      for (const event of events) {
        const costUsd = Number(event.costUsd ?? 0);
        const tokens = event.inputTokens + event.outputTokens;
        totalCostUsd += costUsd;
        totalTokens += tokens;
        const user = usersById.get(event.userId) ?? {
          userId: event.userId,
          name: event.userName,
          email: event.userEmail,
          requests: 0,
          tokens: 0,
          costUsd: 0,
        };
        user.requests += 1;
        user.tokens += tokens;
        user.costUsd += costUsd;
        usersById.set(event.userId, user);
        const modelKey = `${event.provider}:${event.model}`;
        const model = modelsById.get(modelKey) ?? {
          provider: event.provider,
          model: event.model,
          requests: 0,
          tokens: 0,
          costUsd: 0,
        };
        model.requests += 1;
        model.tokens += tokens;
        model.costUsd += costUsd;
        modelsById.set(modelKey, model);
      }
      const sortByCost = <T extends { costUsd: number }>(items: T[]) =>
        items
          .sort((a, b) => b.costUsd - a.costUsd)
          .map((item) => ({ ...item, costUsd: Number(item.costUsd.toFixed(6)) }));
      return {
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
        totalRequests: events.length,
        totalTokens,
        byUser: sortByCost([...usersById.values()]),
        byModel: sortByCost([...modelsById.values()]),
      };
    }),
  }),

  gateway: router({
    /**
     * Runtime preflight — kill switch and budgets are loaded server-side.
     * Client-supplied killSwitchActive is ignored (cannot self-authorize).
     */
    evaluate: protectedProcedure
      .input(
        workspaceInput.extend({
          provider: z.string().min(1).max(64),
          model: z.string().min(1).max(128),
          inputText: z.string().max(200000).optional(),
          toolNames: z.array(z.string().max(128)).max(100).optional(),
          estimatedCostUsd: z.number().min(0).default(0),
          remainingBudgetUsd: z.number().min(0).optional(),
          /** @deprecated Ignored — server loads kill switch from DB */
          killSwitchActive: z.boolean().optional(),
          allowedProviders: z.array(z.string().max(64)).optional(),
          allowedModels: z.array(z.string().max(128)).optional(),
          blockedTools: z.array(z.string().max(128)).optional(),
          redactPii: z.boolean().default(true),
          blockPromptInjection: z.boolean().default(true),
          projectId: z.string().max(64).optional(),
          agentId: z.string().max(128).optional(),
          step: z.number().int().positive().optional(),
          retryCount: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        await readAccess(input.workspaceId, ctx.user.id);

        // Server-side kill switch + budget (never trust client).
        // Prefer Redis hot cache for propagation latency; fall back to Postgres.
        const cached = await readKillSwitchCache(ctx.user.id);
        const ks = cached ? null : await db.getKillSwitchSettings(ctx.user.id);
        const killActive = cached ? cached.isActive : Boolean(ks?.isActive);
        const budgetLimit = cached
          ? cached.budgetLimitUsd
          : ks
            ? toNumber(ks.budgetLimitUSD)
            : undefined;
        const currentSpend = cached
          ? (cached.currentSpendUsd ?? 0)
          : ks
            ? toNumber(ks.currentSpendUSD)
            : 0;
        const remainingFromDb =
          budgetLimit != null ? Math.max(0, budgetLimit - currentSpend) : undefined;

        const state: KillSwitchState = {
          workspaceDisabled: killActive,
          projectDisabled: false,
          agentDisabled: false,
          budgetLimitUsd: budgetLimit,
          currentSpendUsd: currentSpend,
          allowedModels: input.allowedModels,
          allowedProviders: input.allowedProviders,
          updatedAt: new Date().toISOString(),
        };

        const enforcement = decideEnforcement(
          {
            workspaceId: String(input.workspaceId),
            projectId: input.projectId,
            agentId: input.agentId,
            provider: input.provider!,
            model: input.model!,
            toolNames: input.toolNames,
            estimatedCostUsd: input.estimatedCostUsd ?? 0,
            step: input.step,
            retryCount: input.retryCount,
            inputText: input.inputText,
          },
          state,
          "closed",
        );

        if (!enforcement.allowed) {
          try {
            await db.createAuditLogEntry(ctx.user.id, "gateway_blocked", {
              workspaceId: input.workspaceId,
              reasons: enforcement.reasons,
              provider: input.provider,
              model: input.model,
            });
          } catch {
            /* best effort audit */
          }
          return {
            decision: "blocked" as const,
            reasons: enforcement.reasons,
            piiRedactions: 0,
            promptInjectionDetected: false,
            estimatedCostUsd: input.estimatedCostUsd ?? 0,
            rawPromptStored: false,
            killSwitchEnforced: killActive,
            serverEnforced: true,
          };
        }

        // AgentGuard: autonomous runaway-loop / rate-anomaly detection. Counts
        // this agent's gateway calls (and identical-prompt repeats) in a sliding
        // window; on a detected loop it auto-trips the kill switch so subsequent
        // calls are severed, then blocks this call.
        if (input.agentId) {
          const loopStore = createRedisLoopStore(redis as never);
          if (loopStore) {
            const promptHash = input.inputText ? sha256(input.inputText) : undefined;
            const loop = await detectAgentLoop(loopStore, {
              scopeKey: `${input.workspaceId}:${input.agentId}`,
              promptHash,
            });
            if (loop.loopDetected) {
              try {
                // Autonomous action: sever further spend by activating the kill switch.
                await db.updateKillSwitchSettings(ctx.user.id, undefined, true);
                await db.createKillSwitchEvent(
                  ctx.user.id,
                  "auto_triggered",
                  budgetLimit,
                  currentSpend,
                  loop.reasons[0],
                  { agentId: input.agentId, ...loop },
                );
                await db.createAuditLogEntry(ctx.user.id, "agentguard_loop_blocked", {
                  workspaceId: input.workspaceId,
                  agentId: input.agentId,
                  reasons: loop.reasons,
                  callsInWindow: loop.callsInWindow,
                  duplicatePromptCount: loop.duplicatePromptCount,
                });
              } catch {
                /* best effort autonomous action + audit */
              }
              return {
                decision: "blocked" as const,
                reasons: loop.reasons,
                piiRedactions: 0,
                promptInjectionDetected: false,
                estimatedCostUsd: input.estimatedCostUsd ?? 0,
                rawPromptStored: false,
                killSwitchEnforced: true,
                serverEnforced: true,
                loopDetected: true,
              };
            }
          }
        }

        const result = evaluateGatewayRequest({
          provider: input.provider!,
          model: input.model!,
          inputText: input.inputText,
          toolNames: input.toolNames,
          estimatedCostUsd: input.estimatedCostUsd ?? 0,
          remainingBudgetUsd: remainingFromDb ?? input.remainingBudgetUsd,
          killSwitchActive: killActive,
          allowedProviders: input.allowedProviders,
          allowedModels: input.allowedModels,
          blockedTools: input.blockedTools,
          redactPii: input.redactPii ?? true,
          blockPromptInjection: input.blockPromptInjection ?? true,
        });
        return {
          ...result,
          rawPromptStored: false,
          killSwitchEnforced: killActive,
          serverEnforced: true,
        };
      }),
  }),

  summary: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
    await readAccess(input.workspaceId, ctx.user.id);
    const database = await db.getDb();
    if (!database) return { providers: 0, credentials: 0, openFindings: 0, subscriptions: 0 };
    const [accounts, credentials, findings, subscriptions] = await Promise.all([
      database
        .select({ id: providerAccounts.id })
        .from(providerAccounts)
        .where(eq(providerAccounts.workspaceId, input.workspaceId)),
      database
        .select({ id: controlPlaneCredentials.id })
        .from(controlPlaneCredentials)
        .where(
          and(
            eq(controlPlaneCredentials.workspaceId, input.workspaceId),
            eq(controlPlaneCredentials.status, "active"),
          ),
        ),
      database
        .select({ id: controlPlaneDiscoveryFindings.id })
        .from(controlPlaneDiscoveryFindings)
        .where(
          and(
            eq(controlPlaneDiscoveryFindings.workspaceId, input.workspaceId),
            eq(controlPlaneDiscoveryFindings.status, "open"),
          ),
        ),
      database
        .select({ id: aiSubscriptions.id })
        .from(aiSubscriptions)
        .where(eq(aiSubscriptions.workspaceId, input.workspaceId)),
    ]);
    return {
      providers: accounts.length,
      credentials: credentials.length,
      openFindings: findings.length,
      subscriptions: subscriptions.length,
    };
  }),
  recentEvidence: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
    await readAccess(input.workspaceId, ctx.user.id);
    const database = await db.getDb();
    if (!database) return [];
    const actions = [
      "openai_administration_connected",
      "openai_gateway_connected",
      "gateway_blocked",
      "kill_switch_triggered",
      "kill_switch_reset",
      "kill_switch_budget_set",
      "team_governance_budget_set",
      "team_governance_kill_switch_set",
      "provider_sync_completed",
    ];
    return database
      .select({ id: auditLog.id, action: auditLog.action, createdAt: auditLog.createdAt })
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.action, actions),
          sql`${auditLog.details}->>'workspaceId' = ${String(input.workspaceId)}`,
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(12);
  }),
});
