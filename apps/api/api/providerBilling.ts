import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { controlPlaneCredentials, providerAccounts } from "@rakshex/database/schema-enterprise";
import {
  providerBillingConnections,
  providerReconciliationWindows,
} from "@rakshex/database/schema-billing";
import { editorProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { reconcileOpenAiBilling } from "../services/billing/openAiBillingReconciliation";
import { assertWorkspacePermission } from "../services/workspaceContext";
import { encryptSecret, getVault } from "../services/vault";

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });

export const BILLING_CHECKSUM_COPY = {
  primaryMeter: "The Rakshex gateway is the live tracking and control plane.",
  optionalChecksum:
    "Optional: add a read-only OpenAI admin key to match gateway-attributed spend to OpenAI Costs and Usage. Live tracking works without this key.",
  scope:
    "This key is used only for OpenAI Costs and Usage reads. It is never used to send prompts.",
} as const;

async function readAccess(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "policies", "read");
}

async function writeAccess(workspaceId: number, userId: number) {
  return assertWorkspacePermission(workspaceId, userId, "policies", "write");
}

function noDb(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
}

async function assertOpenAiAdminReadAccess(secret: string) {
  const key = secret.trim();
  if (!key) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "OpenAI admin key is required" });
  }

  if (key.startsWith("sk-") && !key.startsWith("sk-admin-")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use an OpenAI organization Admin API key with read access to Costs and Usage",
    });
  }

  const end = Math.floor(Date.now() / 1000);
  const start = end - 24 * 60 * 60;
  const urls = [
    `https://api.openai.com/v1/organization/costs?start_time=${start}&end_time=${end}&bucket_width=1d&limit=1`,
    `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&end_time=${end}&bucket_width=1d&limit=1`,
  ];

  for (const url of urls) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/json",
          "user-agent": "Rakshex-Billing-Key-Probe/1.0",
        },
      });
    } catch {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Could not verify the OpenAI billing key. Try again when OpenAI is reachable.",
      });
    }
    if (!response.ok) {
      throw new TRPCError({
        code:
          response.status === 401 || response.status === 403
            ? "BAD_REQUEST"
            : "SERVICE_UNAVAILABLE",
        message:
          response.status === 401 || response.status === 403
            ? "That key cannot read OpenAI organization Costs and Usage"
            : `OpenAI billing-key verification failed with status ${response.status}`,
      });
    }
  }
}

export const providerBillingRouter = router({
  trackingRule: protectedProcedure.query(() => BILLING_CHECKSUM_COPY),

  connectionStatus: protectedProcedure
    .input(workspaceInput.extend({ providerAccountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) return { connected: false, optional: true, copy: BILLING_CHECKSUM_COPY };
      const [binding] = await database
        .select({
          id: providerBillingConnections.id,
          updatedAt: providerBillingConnections.updatedAt,
        })
        .from(providerBillingConnections)
        .where(
          and(
            eq(providerBillingConnections.workspaceId, input.workspaceId),
            eq(providerBillingConnections.providerAccountId, input.providerAccountId),
            eq(providerBillingConnections.provider, "openai"),
          ),
        )
        .limit(1);
      return {
        connected: Boolean(binding),
        optional: true,
        updatedAt: binding?.updatedAt ?? null,
        copy: BILLING_CHECKSUM_COPY,
      };
    }),

  connectOpenAiKey: editorProcedure
    .input(
      workspaceInput.extend({
        providerAccountId: z.number().int().positive(),
        secret: z.string().min(8).max(4096),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await writeAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) noDb();

      const [account] = await database!
        .select({ id: providerAccounts.id })
        .from(providerAccounts)
        .where(
          and(
            eq(providerAccounts.id, input.providerAccountId),
            eq(providerAccounts.workspaceId, input.workspaceId),
            eq(providerAccounts.provider, "openai"),
          ),
        )
        .limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "OpenAI account not found" });

      const secret = input.secret.trim();
      await assertOpenAiAdminReadAccess(secret);

      const tenant = `workspace:${input.workspaceId}`;
      const vault = getVault();
      const fingerprint = vault.fingerprint(secret, tenant);

      const [existingBinding] = await database!
        .select({ credentialId: providerBillingConnections.billingCredentialId })
        .from(providerBillingConnections)
        .where(
          and(
            eq(providerBillingConnections.workspaceId, input.workspaceId),
            eq(providerBillingConnections.providerAccountId, input.providerAccountId),
            eq(providerBillingConnections.provider, "openai"),
          ),
        )
        .limit(1);

      const [credential] = await database!
        .insert(controlPlaneCredentials)
        .values({
          workspaceId: input.workspaceId,
          providerAccountId: input.providerAccountId,
          name: "OpenAI billing checksum",
          provider: "openai",
          credentialType: "admin_readonly_api_key",
          environment: "production",
          encryptedValue: encryptSecret(secret, tenant),
          fingerprint,
          keyPrefix: secret.slice(0, Math.min(12, secret.length)),
          createdBy: ctx.user.id,
        })
        .returning({ id: controlPlaneCredentials.id });
      if (!credential) noDb();

      await database!
        .insert(providerBillingConnections)
        .values({
          workspaceId: input.workspaceId,
          providerAccountId: input.providerAccountId,
          provider: "openai",
          billingCredentialId: credential!.id,
        })
        .onConflictDoUpdate({
          target: [
            providerBillingConnections.workspaceId,
            providerBillingConnections.providerAccountId,
            providerBillingConnections.provider,
          ],
          set: { billingCredentialId: credential!.id, updatedAt: new Date() },
        });

      if (existingBinding?.credentialId && existingBinding.credentialId !== credential!.id) {
        await database!
          .update(controlPlaneCredentials)
          .set({ status: "revoked", revokedAt: new Date() })
          .where(
            and(
              eq(controlPlaneCredentials.id, existingBinding.credentialId),
              eq(controlPlaneCredentials.workspaceId, input.workspaceId),
            ),
          );
      }

      await db.createAuditLogEntry(ctx.user.id, "openai_billing_key_connected", {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        credentialId: credential!.id,
        purpose: "optional_provider_checksum",
      });
      return { connected: true, optional: true, copy: BILLING_CHECKSUM_COPY };
    }),

  revokeOpenAiKey: editorProcedure
    .input(workspaceInput.extend({ providerAccountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await writeAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) noDb();
      const [binding] = await database!
        .select({ credentialId: providerBillingConnections.billingCredentialId })
        .from(providerBillingConnections)
        .where(
          and(
            eq(providerBillingConnections.workspaceId, input.workspaceId),
            eq(providerBillingConnections.providerAccountId, input.providerAccountId),
            eq(providerBillingConnections.provider, "openai"),
          ),
        )
        .limit(1);
      if (!binding) return { connected: false, optional: true };

      await database!
        .update(controlPlaneCredentials)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(controlPlaneCredentials.id, binding.credentialId),
            eq(controlPlaneCredentials.workspaceId, input.workspaceId),
          ),
        );
      await database!
        .delete(providerBillingConnections)
        .where(
          and(
            eq(providerBillingConnections.workspaceId, input.workspaceId),
            eq(providerBillingConnections.providerAccountId, input.providerAccountId),
            eq(providerBillingConnections.provider, "openai"),
          ),
        );

      await db.createAuditLogEntry(ctx.user.id, "openai_billing_key_revoked", {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        credentialId: binding.credentialId,
      });
      return { connected: false, optional: true };
    }),

  bindOpenAi: editorProcedure
    .input(
      workspaceInput.extend({
        providerAccountId: z.number().int().positive(),
        credentialId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await writeAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) noDb();

      const [account] = await database!
        .select({ id: providerAccounts.id })
        .from(providerAccounts)
        .where(
          and(
            eq(providerAccounts.id, input.providerAccountId),
            eq(providerAccounts.workspaceId, input.workspaceId),
            eq(providerAccounts.provider, "openai"),
          ),
        )
        .limit(1);
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "OpenAI account not found" });

      const [credential] = await database!
        .select({
          id: controlPlaneCredentials.id,
          credentialType: controlPlaneCredentials.credentialType,
          status: controlPlaneCredentials.status,
        })
        .from(controlPlaneCredentials)
        .where(
          and(
            eq(controlPlaneCredentials.id, input.credentialId),
            eq(controlPlaneCredentials.workspaceId, input.workspaceId),
            eq(controlPlaneCredentials.provider, "openai"),
          ),
        )
        .limit(1);
      if (
        !credential ||
        credential.status !== "active" ||
        credential.credentialType !== "admin_readonly_api_key"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An active OpenAI admin_readonly_api_key credential is required",
        });
      }

      const [binding] = await database!
        .insert(providerBillingConnections)
        .values({
          workspaceId: input.workspaceId,
          providerAccountId: input.providerAccountId,
          provider: "openai",
          billingCredentialId: input.credentialId,
        })
        .onConflictDoUpdate({
          target: [
            providerBillingConnections.workspaceId,
            providerBillingConnections.providerAccountId,
            providerBillingConnections.provider,
          ],
          set: {
            billingCredentialId: input.credentialId,
            updatedAt: new Date(),
          },
        })
        .returning({ id: providerBillingConnections.id });

      await db.createAuditLogEntry(ctx.user.id, "openai_billing_connection_bound", {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        credentialId: input.credentialId,
      });
      return { id: binding?.id };
    }),

  reconcileOpenAi: editorProcedure
    .input(
      workspaceInput.extend({
        providerAccountId: z.number().int().positive(),
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await writeAccess(input.workspaceId, ctx.user.id);
      const result = await reconcileOpenAiBilling({
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        start: new Date(input.start),
        end: new Date(input.end),
      });
      await db.createAuditLogEntry(ctx.user.id, "openai_billing_reconciled", {
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        start: input.start,
        end: input.end,
        providerBilledUsd: result.providerBilledUsd,
        gatewayAttributedUsd: result.gatewayAttributedUsd,
        driftPct: result.driftPct,
        status: result.status,
      });
      return result;
    }),

  latestOpenAi: protectedProcedure
    .input(workspaceInput.extend({ providerAccountId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await readAccess(input.workspaceId, ctx.user.id);
      const database = await db.getDb();
      if (!database) return null;
      const [latest] = await database
        .select()
        .from(providerReconciliationWindows)
        .where(
          and(
            eq(providerReconciliationWindows.workspaceId, input.workspaceId),
            eq(providerReconciliationWindows.providerAccountId, input.providerAccountId),
            eq(providerReconciliationWindows.provider, "openai"),
          ),
        )
        .orderBy(desc(providerReconciliationWindows.reconciledAt))
        .limit(1);
      return latest ?? null;
    }),
});
