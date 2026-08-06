import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  actionAllowed,
  evaluateAction,
  normalizeSemanticAction,
  semanticActionCatalog,
  validateAttenuation,
  type AuthorityScope,
  type ControlPolicy,
} from "@rakshex/action-control";
import {
  actionApprovals,
  actionLedger,
  agentIdentities,
  brokeredCredentials,
  credentialEgressLog,
  delegatedAuthorities,
} from "@rakshex/database";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { requireWorkspaceMembership, requireWorkspacePermission } from "../services/authorization";
import {
  authorizeBrokeredRequest,
  executeBrokeredCall,
  originOf,
  redactSecret,
  type CredentialInjection,
} from "../services/credentialBroker";
import { decryptSecret, encryptSecret, isVaultConfigured } from "../services/vault";
import { logSecurityEvent } from "../services/securityEvents";
import { exportLedgerToSiem } from "../services/ledgerSiemExport";

type ApiKeyAuthContext = { workspaceId: number; scopes: string[] };

function assertRuntimeApiKeyScope(
  user: { id: number },
  workspaceId: number,
  requiredScope: string,
): void {
  const keyAuth = (user as typeof user & { __apiKeyAuth?: ApiKeyAuthContext }).__apiKeyAuth;
  if (!keyAuth) return;
  if (keyAuth.workspaceId !== workspaceId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "API key belongs to another workspace" });
  }
  if (!keyAuth.scopes.includes("*") && !keyAuth.scopes.includes(requiredScope)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `API key requires ${requiredScope} scope` });
  }
}

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });
const scopeSchema = z.object({
  actions: z.array(z.string().min(1).max(128)).min(1).max(100),
  resources: z.array(z.string().min(1).max(512)).max(100).optional(),
  environments: z.array(z.string().min(1).max(32)).max(20).optional(),
  maxAmountMinor: z.number().int().nonnegative().optional(),
  currency: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  maxCount: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  maxDelegationDepth: z.number().int().min(0).max(10).optional(),
  purpose: z.string().max(500).optional(),
});
const policySchema = z.object({
  version: z.string().min(1).max(128),
  denyActions: z.array(z.string().max(128)).max(100).optional(),
  approvalActions: z.array(z.string().max(128)).max(100).optional(),
  approvalAboveMinor: z.number().int().nonnegative().optional(),
  dailyAmountLimitMinor: z.number().int().nonnegative().optional(),
  dangerousSequences: z
    .array(z.array(z.string().max(128)).min(2).max(10))
    .max(25)
    .optional(),
  unknownWriteDecision: z.enum(["DENY", "APPROVAL_REQUIRED"]).optional(),
});

const DEFAULT_POLICY: ControlPolicy = {
  version: "rakshex-default:0.1",
  approvalActions: ["code.merge", "code.deploy", "database.schema.change"],
  approvalAboveMinor: 200_000,
  dangerousSequences: [
    ["database.read", "communication.email.send"],
    ["code.pr.create", "code.merge"],
  ],
  unknownWriteDecision: "DENY",
};

function requireDb<T>(database: T | null): T {
  if (!database) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }
  return database;
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function capabilityHash(token: string): string {
  return crypto
    .createHmac("sha256", ENV.cookieSecret)
    .update("rakshex:capability:v1\0")
    .update(token)
    .digest("hex");
}

function scopeFromRow(raw: unknown): AuthorityScope {
  const parsed = scopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stored authority scope is invalid",
    });
  }
  return parsed.data as AuthorityScope;
}

function policyFromRow(raw: unknown): ControlPolicy {
  const parsed = policySchema.safeParse(raw);
  return parsed.success ? (parsed.data as ControlPolicy) : DEFAULT_POLICY;
}

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const agentFirewallRouter = router({
  catalog: protectedProcedure.query(() => ({ version: "0.1", actions: semanticActionCatalog() })),

  identities: router({
    list: protectedProcedure.input(workspaceInput).query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "read");
      const database = requireDb(await db.getDb());
      return database
        .select()
        .from(agentIdentities)
        .where(eq(agentIdentities.workspaceId, input.workspaceId))
        .orderBy(desc(agentIdentities.updatedAt));
    }),

    create: protectedProcedure
      .input(
        workspaceInput.extend({
          agentKey: z
            .string()
            .min(1)
            .max(128)
            .regex(/^[a-zA-Z0-9._:-]+$/),
          name: z.string().min(1).max(255),
          ownerUserId: z.number().int().positive().optional(),
          framework: z.string().max(64).optional(),
          model: z.string().max(128).optional(),
          environment: z.string().min(1).max(32).default("production"),
          version: z.string().min(1).max(64).default("1"),
          mode: z.enum(["shadow", "enforce"]).default("shadow"),
          capabilities: z.array(z.string().max(128)).max(100).default([]),
          policy: policySchema.optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [created] = await database
          .insert(agentIdentities)
          .values({
            id: id("agt"),
            workspaceId: input.workspaceId,
            agentKey: input.agentKey,
            name: input.name,
            ownerUserId: input.ownerUserId ?? ctx.user.id,
            framework: input.framework,
            model: input.model,
            environment: input.environment,
            version: input.version,
            mode: input.mode,
            capabilities: input.capabilities,
            policyConfig: input.policy ?? DEFAULT_POLICY,
          })
          .returning();
        await db.createAuditLogEntry(ctx.user.id, "agent_identity_created", {
          workspaceId: input.workspaceId,
          agentId: created?.id,
          agentKey: input.agentKey,
          mode: input.mode,
        });
        return created;
      }),

    setMode: protectedProcedure
      .input(
        workspaceInput.extend({ agentId: z.string().min(1), mode: z.enum(["shadow", "enforce"]) }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [updated] = await database
          .update(agentIdentities)
          .set({ mode: input.mode, updatedAt: new Date() })
          .where(
            and(
              eq(agentIdentities.id, input.agentId),
              eq(agentIdentities.workspaceId, input.workspaceId),
            ),
          )
          .returning({ id: agentIdentities.id, mode: agentIdentities.mode });
        if (!updated)
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent identity not found" });
        await db.createAuditLogEntry(ctx.user.id, "agent_firewall_mode_changed", input);
        return updated;
      }),

    setStatus: protectedProcedure
      .input(
        workspaceInput.extend({
          agentId: z.string().min(1),
          status: z.enum(["active", "paused", "revoked"]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [updated] = await database
          .update(agentIdentities)
          .set({ status: input.status, updatedAt: new Date() })
          .where(
            and(
              eq(agentIdentities.id, input.agentId),
              eq(agentIdentities.workspaceId, input.workspaceId),
            ),
          )
          .returning({ id: agentIdentities.id, status: agentIdentities.status });
        if (!updated)
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent identity not found" });
        await db.createAuditLogEntry(ctx.user.id, "agent_identity_status_changed", input);
        return updated;
      }),
  }),

  authorities: router({
    list: protectedProcedure
      .input(workspaceInput.extend({ agentId: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "read");
        const database = requireDb(await db.getDb());
        const filters = [eq(delegatedAuthorities.workspaceId, input.workspaceId)];
        if (input.agentId) filters.push(eq(delegatedAuthorities.agentId, input.agentId));
        const rows = await database
          .select()
          .from(delegatedAuthorities)
          .where(and(...filters))
          .orderBy(desc(delegatedAuthorities.createdAt));
        return rows.map(({ capabilityTokenHash: _hash, ...row }) => row);
      }),

    create: protectedProcedure
      .input(
        workspaceInput.extend({
          agentId: z.string().min(1),
          parentAuthorityId: z.string().optional(),
          scope: scopeSchema,
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [agent] = await database
          .select()
          .from(agentIdentities)
          .where(
            and(
              eq(agentIdentities.id, input.agentId),
              eq(agentIdentities.workspaceId, input.workspaceId),
            ),
          )
          .limit(1);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent identity not found" });

        const childScope = scopeFromRow(input.scope);
        let depth = 0;
        if (input.parentAuthorityId) {
          const [parent] = await database
            .select()
            .from(delegatedAuthorities)
            .where(
              and(
                eq(delegatedAuthorities.id, input.parentAuthorityId),
                eq(delegatedAuthorities.workspaceId, input.workspaceId),
                eq(delegatedAuthorities.status, "active"),
              ),
            )
            .limit(1);
          if (!parent)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Parent authority not found or inactive",
            });
          const attenuation = validateAttenuation(scopeFromRow(parent.scope), childScope);
          if (!attenuation.valid) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Authority is not attenuated: ${attenuation.reasons.join("; ")}`,
            });
          }
          depth = parent.depth + 1;
        }
        const rawToken = `rk_cap_${crypto.randomBytes(32).toString("base64url")}`;
        const authorityId = id("authz");
        const [created] = await database
          .insert(delegatedAuthorities)
          .values({
            id: authorityId,
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            principalUserId: agent.ownerUserId,
            issuedByUserId: ctx.user.id,
            parentAuthorityId: input.parentAuthorityId,
            scope: childScope as unknown as Record<string, unknown>,
            scopeHash: sha256(canonical(childScope)),
            capabilityTokenHash: capabilityHash(rawToken),
            capabilityPrefix: rawToken.slice(0, 16),
            depth,
            validFrom: input.scope.validFrom ? new Date(input.scope.validFrom) : new Date(),
            expiresAt: input.scope.expiresAt ? new Date(input.scope.expiresAt) : undefined,
          })
          .returning({
            id: delegatedAuthorities.id,
            capabilityPrefix: delegatedAuthorities.capabilityPrefix,
            expiresAt: delegatedAuthorities.expiresAt,
          });
        await db.createAuditLogEntry(ctx.user.id, "delegated_authority_created", {
          workspaceId: input.workspaceId,
          authorityId,
          agentId: input.agentId,
          parentAuthorityId: input.parentAuthorityId,
          scopeHash: sha256(canonical(childScope)),
        });
        return { ...created, capabilityToken: rawToken, shownOnce: true };
      }),

    revoke: protectedProcedure
      .input(
        workspaceInput.extend({
          authorityId: z.string().min(1),
          reason: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [updated] = await database
          .update(delegatedAuthorities)
          .set({ status: "revoked", revokedAt: new Date(), revokedByUserId: ctx.user.id })
          .where(
            and(
              eq(delegatedAuthorities.id, input.authorityId),
              eq(delegatedAuthorities.workspaceId, input.workspaceId),
            ),
          )
          .returning({ id: delegatedAuthorities.id });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Authority not found" });
        await db.createAuditLogEntry(ctx.user.id, "delegated_authority_revoked", input);
        return { success: true };
      }),
  }),

  evaluate: protectedProcedure
    .input(
      workspaceInput.extend({
        agentId: z.string().min(1),
        authorityId: z.string().optional(),
        capabilityToken: z.string().min(20).max(256).optional(),
        idempotencyKey: z.string().min(8).max(128),
        traceId: z.string().min(1).max(128).optional(),
        projectId: z.string().max(64).optional(),
        provider: z.string().min(1).max(64),
        operation: z.string().min(1).max(256),
        toolName: z.string().max(256).optional(),
        requestId: z.string().max(128).optional(),
        parameters: z.record(z.unknown()).default({}),
        resource: z.string().max(512).optional(),
        environment: z.string().max(32).optional(),
        amountMinor: z.number().int().nonnegative().optional(),
        currency: z.string().length(3).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspaceMembership(input.workspaceId, ctx.user.id);
      assertRuntimeApiKeyScope(ctx.user, input.workspaceId, "agent:execute");
      const database = requireDb(await db.getDb());
      const [existing] = await database
        .select()
        .from(actionLedger)
        .where(
          and(
            eq(actionLedger.workspaceId, input.workspaceId),
            eq(actionLedger.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) {
        return {
          ...existing,
          amountMinor: existing.amountMinor == null ? null : numeric(existing.amountMinor),
          replayed: true,
        };
      }

      const [agent] = await database
        .select()
        .from(agentIdentities)
        .where(
          and(
            eq(agentIdentities.id, input.agentId),
            eq(agentIdentities.workspaceId, input.workspaceId),
          ),
        )
        .limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent identity not found" });

      let authority;
      if (input.capabilityToken) {
        [authority] = await database
          .select()
          .from(delegatedAuthorities)
          .where(
            and(
              eq(delegatedAuthorities.workspaceId, input.workspaceId),
              eq(delegatedAuthorities.agentId, input.agentId),
              eq(delegatedAuthorities.capabilityTokenHash, capabilityHash(input.capabilityToken)),
              eq(delegatedAuthorities.status, "active"),
            ),
          )
          .limit(1);
      } else {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        if (input.authorityId) {
          [authority] = await database
            .select()
            .from(delegatedAuthorities)
            .where(
              and(
                eq(delegatedAuthorities.id, input.authorityId),
                eq(delegatedAuthorities.workspaceId, input.workspaceId),
                eq(delegatedAuthorities.agentId, input.agentId),
                eq(delegatedAuthorities.status, "active"),
              ),
            )
            .limit(1);
        }
      }

      const action = normalizeSemanticAction({
        provider: input.provider,
        operation: input.operation,
        toolName: input.toolName,
        requestId: input.requestId,
        parameters: input.parameters,
        resource: input.resource,
        environment: input.environment ?? agent.environment,
        amountMinor: input.amountMinor,
        currency: input.currency,
      });
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await database
        .select({
          semanticAction: actionLedger.semanticAction,
          amountMinor: actionLedger.amountMinor,
        })
        .from(actionLedger)
        .where(
          and(
            eq(actionLedger.workspaceId, input.workspaceId),
            eq(actionLedger.agentId, input.agentId),
            gte(actionLedger.occurredAt, since),
          ),
        )
        .orderBy(desc(actionLedger.occurredAt))
        .limit(1000);
      const cumulative = {
        actionCount: recent.length,
        amountMinor: recent.reduce((sum, row) => sum + numeric(row.amountMinor), 0),
        recentActions: recent
          .slice(0, 20)
          .reverse()
          .map((row) => row.semanticAction),
      };
      const result = evaluateAction({
        mode: agent.mode,
        action,
        authority: authority ? scopeFromRow(authority.scope) : null,
        cumulative,
        policy: policyFromRow(agent.policyConfig),
        frozen: agent.status !== "active",
      });

      const [previous] = await database
        .select({ recordHash: actionLedger.recordHash })
        .from(actionLedger)
        .where(eq(actionLedger.workspaceId, input.workspaceId))
        .orderBy(desc(actionLedger.occurredAt))
        .limit(1);
      const ledgerId = id("act");
      const approvalId = result.decision === "APPROVAL_REQUIRED" ? id("apr") : undefined;
      const traceId = input.traceId ?? id("trace");
      const record = {
        id: ledgerId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        agentId: input.agentId,
        principalUserId: authority?.principalUserId ?? agent.ownerUserId,
        authorityId: authority?.id,
        traceId,
        idempotencyKey: input.idempotencyKey,
        mode: agent.mode,
        semanticAction: action.name,
        actionVersion: action.version,
        domain: action.domain,
        effect: action.effect,
        parametersRedacted: action.parameters,
        resource: action.resource,
        environment: action.environment,
        rawReference: action.raw as unknown as Record<string, unknown>,
        policyVersion: result.policyVersion,
        decision: result.decision,
        effectiveDecision: result.effectiveDecision,
        reasons: result.reasons,
        amountMinor: action.amountMinor == null ? undefined : String(action.amountMinor),
        currency: action.currency,
        approvalId,
        previousHash: previous?.recordHash,
      };
      const recordHash = sha256(`${previous?.recordHash ?? "GENESIS"}\n${canonical(record)}`);
      await database.insert(actionLedger).values({ ...record, recordHash });
      if (approvalId) {
        await database.insert(actionApprovals).values({
          id: approvalId,
          workspaceId: input.workspaceId,
          ledgerId,
          requestedByAgentId: input.agentId,
          semanticAction: action.name,
          resource: action.resource,
          amountMinor: action.amountMinor == null ? undefined : String(action.amountMinor),
          currency: action.currency,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });
      }
      if (authority && agent.mode === "enforce" && result.effectiveDecision === "ALLOW") {
        await database
          .update(delegatedAuthorities)
          .set({
            useCount: sql`${delegatedAuthorities.useCount} + 1`,
            amountUsedMinor: sql`${delegatedAuthorities.amountUsedMinor} + ${action.amountMinor ?? 0}`,
          })
          .where(eq(delegatedAuthorities.id, authority.id));
      }
      return {
        ledgerId,
        traceId,
        approvalId,
        mode: agent.mode,
        normalizedAction: action,
        ...result,
        replayed: false,
      };
    }),

  ledger: router({
    list: protectedProcedure
      .input(
        workspaceInput.extend({
          agentId: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(100),
        }),
      )
      .query(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "audit", "read");
        const database = requireDb(await db.getDb());
        const filters = [eq(actionLedger.workspaceId, input.workspaceId)];
        if (input.agentId) filters.push(eq(actionLedger.agentId, input.agentId));
        const rows = await database
          .select()
          .from(actionLedger)
          .where(and(...filters))
          .orderBy(desc(actionLedger.occurredAt))
          .limit(input.limit);
        return rows.map((row) => ({
          ...row,
          amountMinor: row.amountMinor == null ? null : numeric(row.amountMinor),
        }));
      }),
    /**
     * Export ledger records in a SIEM-native format.
     *
     * Enterprises will not accept evidence that only lives in our dashboard —
     * it has to reach their SIEM, where their detection rules and retention
     * already are. Supports CEF (ArcSight/QRadar), RFC 5424 syslog, Splunk
     * HEC, and NDJSON.
     *
     * Returns the formatted body plus its content type so a caller can stream
     * it straight to a collector. Read-only and audit-scoped: this is evidence
     * export, so it uses the same permission as reading the audit log rather
     * than the looser membership check.
     */
    exportSiem: protectedProcedure
      .input(
        workspaceInput.extend({
          format: z.enum(["ndjson", "cef", "syslog", "splunk_hec"]).default("ndjson"),
          agentId: z.string().min(1).max(64).optional(),
          since: z.string().datetime().optional(),
          limit: z.number().int().min(1).max(5000).default(1000),
        }),
      )
      .query(async ({ ctx, input }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "audit", "read");
        const database = requireDb(await db.getDb());

        const filters = [eq(actionLedger.workspaceId, input.workspaceId)];
        if (input.agentId) filters.push(eq(actionLedger.agentId, input.agentId));
        if (input.since) filters.push(gte(actionLedger.occurredAt, new Date(input.since)));

        const rows = await database
          .select()
          .from(actionLedger)
          .where(filters.length === 1 ? filters[0] : and(...filters))
          .orderBy(desc(actionLedger.occurredAt))
          .limit(input.limit);

        const result = exportLedgerToSiem(rows, input.format);
        logSecurityEvent(
          "siem_export_generated",
          {
            workspaceId: input.workspaceId,
            format: input.format,
            recordCount: result.recordCount,
          },
          { userId: ctx.user.id },
        );
        return result;
      }),

    outcome: protectedProcedure
      .input(
        workspaceInput.extend({
          ledgerId: z.string().min(1),
          status: z.enum(["succeeded", "failed", "reversed", "not_executed"]),
          outcome: z.record(z.unknown()).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [updated] = await database
          .update(actionLedger)
          .set({ outcomeStatus: input.status, outcome: input.outcome, completedAt: new Date() })
          .where(
            and(
              eq(actionLedger.id, input.ledgerId),
              eq(actionLedger.workspaceId, input.workspaceId),
            ),
          )
          .returning({ id: actionLedger.id });
        if (!updated)
          throw new TRPCError({ code: "NOT_FOUND", message: "Ledger record not found" });
        return { success: true };
      }),
  }),

  approvals: router({
    list: protectedProcedure
      .input(
        workspaceInput.extend({
          status: z
            .enum(["pending", "approved", "rejected", "expired", "consumed"])
            .default("pending"),
        }),
      )
      .query(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "read");
        const database = requireDb(await db.getDb());
        return database
          .select()
          .from(actionApprovals)
          .where(
            and(
              eq(actionApprovals.workspaceId, input.workspaceId),
              eq(actionApprovals.status, input.status),
            ),
          )
          .orderBy(desc(actionApprovals.createdAt))
          .limit(100);
      }),
    resolve: protectedProcedure
      .input(
        workspaceInput.extend({
          approvalId: z.string().min(1),
          decision: z.enum(["approved", "rejected"]),
          note: z.string().max(1000).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        const [approval] = await database
          .select()
          .from(actionApprovals)
          .where(
            and(
              eq(actionApprovals.id, input.approvalId),
              eq(actionApprovals.workspaceId, input.workspaceId),
              eq(actionApprovals.status, "pending"),
            ),
          )
          .limit(1);
        if (!approval)
          throw new TRPCError({ code: "NOT_FOUND", message: "Pending approval not found" });
        if (approval.expiresAt <= new Date()) {
          await database
            .update(actionApprovals)
            .set({ status: "expired" })
            .where(eq(actionApprovals.id, approval.id));
          throw new TRPCError({ code: "BAD_REQUEST", message: "Approval has expired" });
        }
        await database.transaction(async (tx) => {
          await tx
            .update(actionApprovals)
            .set({
              status: input.decision,
              resolvedAt: new Date(),
              resolvedByUserId: ctx.user.id,
              resolutionNote: input.note,
            })
            .where(eq(actionApprovals.id, approval.id));
          await tx
            .update(actionLedger)
            .set({ effectiveDecision: input.decision === "approved" ? "ALLOW" : "DENY" })
            .where(
              and(
                eq(actionLedger.id, approval.ledgerId),
                eq(actionLedger.workspaceId, input.workspaceId),
              ),
            );
        });
        await db.createAuditLogEntry(ctx.user.id, `action_approval_${input.decision}`, {
          workspaceId: input.workspaceId,
          approvalId: input.approvalId,
          ledgerId: approval.ledgerId,
        });
        return {
          success: true,
          ledgerId: approval.ledgerId,
          effectiveDecision: input.decision === "approved" ? "ALLOW" : "DENY",
        };
      }),
    consume: protectedProcedure
      .input(workspaceInput.extend({ approvalId: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await requireWorkspaceMembership(input.workspaceId, ctx.user.id);
        assertRuntimeApiKeyScope(ctx.user, input.workspaceId, "agent:execute");
        const database = requireDb(await db.getDb());
        return database.transaction(async (tx) => {
          const [approval] = await tx
            .select()
            .from(actionApprovals)
            .where(
              and(
                eq(actionApprovals.id, input.approvalId),
                eq(actionApprovals.workspaceId, input.workspaceId),
                eq(actionApprovals.status, "approved"),
              ),
            )
            .limit(1)
            .for("update");
          if (!approval) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Approved action not found or already consumed",
            });
          }
          if (approval.expiresAt <= new Date()) {
            await tx
              .update(actionApprovals)
              .set({ status: "expired" })
              .where(eq(actionApprovals.id, approval.id));
            throw new TRPCError({ code: "BAD_REQUEST", message: "Approval has expired" });
          }
          const [ledger] = await tx
            .select()
            .from(actionLedger)
            .where(
              and(
                eq(actionLedger.id, approval.ledgerId),
                eq(actionLedger.workspaceId, input.workspaceId),
              ),
            )
            .limit(1);
          if (!ledger) throw new TRPCError({ code: "NOT_FOUND", message: "Action not found" });
          await tx
            .update(actionApprovals)
            .set({ status: "consumed", consumedAt: new Date() })
            .where(eq(actionApprovals.id, approval.id));
          return {
            approvalId: approval.id,
            ledgerId: ledger.id,
            semanticAction: ledger.semanticAction,
            resource: ledger.resource,
            parameters: ledger.parametersRedacted,
            effectiveDecision: "ALLOW" as const,
            consumed: true,
          };
        });
      }),
  }),

  policyReplay: protectedProcedure
    .input(
      workspaceInput.extend({
        agentId: z.string().min(1),
        proposedPolicy: policySchema,
        limit: z.number().int().min(1).max(1000).default(250),
      }),
    )
    .query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "read");
      const database = requireDb(await db.getDb());
      const [agent] = await database
        .select()
        .from(agentIdentities)
        .where(
          and(
            eq(agentIdentities.id, input.agentId),
            eq(agentIdentities.workspaceId, input.workspaceId),
          ),
        )
        .limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent identity not found" });
      const [rows, authorities] = await Promise.all([
        database
          .select()
          .from(actionLedger)
          .where(
            and(
              eq(actionLedger.workspaceId, input.workspaceId),
              eq(actionLedger.agentId, input.agentId),
            ),
          )
          .orderBy(desc(actionLedger.occurredAt))
          .limit(input.limit),
        database
          .select()
          .from(delegatedAuthorities)
          .where(eq(delegatedAuthorities.workspaceId, input.workspaceId)),
      ]);
      const authorityById = new Map(authorities.map((authority) => [authority.id, authority]));
      const currentPolicy = policyFromRow(agent.policyConfig);
      const proposedPolicy = policyFromRow(input.proposedPolicy);
      const changes = rows.map((row) => {
        const authority = row.authorityId ? authorityById.get(row.authorityId) : undefined;
        const action = {
          name: row.semanticAction,
          version: "0.1" as const,
          domain: row.domain as "financial" | "code" | "database" | "mcp" | "unknown",
          effect: row.effect as "read" | "write" | "destructive" | "unknown",
          parameters: row.parametersRedacted as Record<string, unknown>,
          resource: row.resource ?? undefined,
          environment: row.environment ?? undefined,
          amountMinor: row.amountMinor == null ? undefined : numeric(row.amountMinor),
          currency: row.currency ?? undefined,
          raw: row.rawReference as { provider: string; operation: string },
          known: row.semanticAction !== "semantic.unknown",
        };
        const base = {
          mode: "enforce" as const,
          action,
          authority: authority ? scopeFromRow(authority.scope) : null,
          frozen: agent.status !== "active",
        };
        const before = evaluateAction({ ...base, policy: currentPolicy });
        const after = evaluateAction({ ...base, policy: proposedPolicy });
        return {
          ledgerId: row.id,
          semanticAction: row.semanticAction,
          before: before.effectiveDecision,
          after: after.effectiveDecision,
          changed: before.effectiveDecision !== after.effectiveDecision,
          reasons: after.reasons,
        };
      });
      return {
        evaluated: changes.length,
        changed: changes.filter((item) => item.changed).length,
        newlyBlocked: changes.filter((item) => item.before === "ALLOW" && item.after !== "ALLOW")
          .length,
        newlyAllowed: changes.filter((item) => item.before !== "ALLOW" && item.after === "ALLOW")
          .length,
        changes: changes.filter((item) => item.changed),
      };
    }),

  shadowReport: protectedProcedure
    .input(
      workspaceInput.extend({
        agentId: z.string().optional(),
        days: z.number().int().min(1).max(90).default(7),
      }),
    )
    .query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "read");
      const database = requireDb(await db.getDb());
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const filters = [
        eq(actionLedger.workspaceId, input.workspaceId),
        eq(actionLedger.mode, "shadow"),
        gte(actionLedger.occurredAt, since),
      ];
      if (input.agentId) filters.push(eq(actionLedger.agentId, input.agentId));
      const rows = await database
        .select()
        .from(actionLedger)
        .where(and(...filters))
        .orderBy(desc(actionLedger.occurredAt))
        .limit(5000);
      const byDecision = Object.fromEntries(
        ["ALLOW", "DENY", "APPROVAL_REQUIRED", "LIMIT", "PAUSE", "FREEZE"].map((decision) => [
          decision,
          rows.filter((row) => row.decision === decision).length,
        ]),
      );
      const risky = rows.filter((row) => row.decision !== "ALLOW");
      const actionCounts = new Map<string, number>();
      for (const row of risky)
        actionCounts.set(row.semanticAction, (actionCounts.get(row.semanticAction) ?? 0) + 1);
      const recommendations = [...actionCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({
          action,
          count,
          recommendation: `Review delegated scope and policy for ${action} before enabling Enforce mode.`,
        }));
      return {
        periodDays: input.days,
        observedActions: rows.length,
        wouldBlock: risky.length,
        byDecision,
        recommendations,
        readyForEnforce: rows.length >= 20 && risky.length / Math.max(rows.length, 1) < 0.1,
      };
    }),

  /**
   * ── Credential mediation ────────────────────────────────────────────────
   *
   * This is what turns the firewall from advisory into enforcing. The raw
   * provider secret is stored encrypted and is never returned by any
   * procedure here — not on create, not on list. The agent only ever holds
   * the credential id, and must present a fresh ALLOW ledger record to get
   * a call made on its behalf.
   */
  credentials: router({
    list: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await requireWorkspaceMembership(input.workspaceId, ctx.user.id);
        const database = requireDb(await db.getDb());
        // Note the explicit column list: secretCiphertext must never be
        // selected into an API response, so we do not `select()` the row.
        const rows = await database
          .select({
            id: brokeredCredentials.id,
            name: brokeredCredentials.name,
            provider: brokeredCredentials.provider,
            allowedActions: brokeredCredentials.allowedActions,
            allowedOrigin: brokeredCredentials.allowedOrigin,
            injection: brokeredCredentials.injection,
            headerName: brokeredCredentials.headerName,
            status: brokeredCredentials.status,
            createdAt: brokeredCredentials.createdAt,
            revokedAt: brokeredCredentials.revokedAt,
            lastUsedAt: brokeredCredentials.lastUsedAt,
          })
          .from(brokeredCredentials)
          .where(eq(brokeredCredentials.workspaceId, input.workspaceId))
          .orderBy(desc(brokeredCredentials.createdAt));
        return { credentials: rows };
      }),

    create: protectedProcedure
      .input(
        workspaceInput.extend({
          name: z.string().min(1).max(256),
          provider: z.string().min(1).max(64),
          secret: z.string().min(8).max(4096),
          allowedActions: z.array(z.string().min(1).max(128)).min(1).max(100),
          allowedOrigin: z.string().url().max(512),
          injection: z.enum(["bearer", "header", "basic"]).default("bearer"),
          headerName: z.string().min(1).max(128).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        assertRuntimeApiKeyScope(ctx.user, input.workspaceId, "agent:execute");
        if (!isVaultConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "RAKSHEX_VAULT_KEY is not configured; credentials cannot be stored securely without it",
          });
        }
        if (input.injection === "header" && !input.headerName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "headerName is required when injection is 'header'",
          });
        }
        // Normalize and re-validate the origin here rather than trusting the
        // URL as given — the broker compares against this value exactly.
        const origin = originOf(input.allowedOrigin);
        if (!origin) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "allowedOrigin must be a valid https URL",
          });
        }
        const database = requireDb(await db.getDb());
        const credentialId = id("cred");
        await database.insert(brokeredCredentials).values({
          id: credentialId,
          workspaceId: input.workspaceId,
          name: input.name,
          provider: input.provider,
          // AAD = workspace id, so this blob is undecryptable in any other
          // workspace's context even if the ciphertext leaks.
          secretCiphertext: encryptSecret(input.secret, String(input.workspaceId)),
          allowedActions: input.allowedActions,
          allowedOrigin: origin,
          injection: input.injection,
          headerName: input.headerName ?? null,
          createdByUserId: ctx.user.id,
        });
        logSecurityEvent(
          "brokered_credential_created",
          { credentialId, provider: input.provider, workspaceId: input.workspaceId },
          { userId: ctx.user.id },
        );
        // Deliberately returns no secret material.
        return { credentialId, allowedOrigin: origin };
      }),

    revoke: protectedProcedure
      .input(workspaceInput.extend({ credentialId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        await requireWorkspacePermission(input.workspaceId, ctx.user.id, "security", "write");
        const database = requireDb(await db.getDb());
        await database
          .update(brokeredCredentials)
          .set({ status: "revoked", revokedAt: new Date() })
          .where(
            and(
              eq(brokeredCredentials.id, input.credentialId),
              eq(brokeredCredentials.workspaceId, input.workspaceId),
            ),
          );
        logSecurityEvent(
          "brokered_credential_revoked",
          { credentialId: input.credentialId, workspaceId: input.workspaceId },
          { userId: ctx.user.id },
        );
        return { success: true };
      }),

    /** Recent brokered calls — the audit view for credential use. */
    egressLog: protectedProcedure
      .input(workspaceInput.extend({ limit: z.number().int().positive().max(500).default(100) }))
      .query(async ({ ctx, input }) => {
        await requireWorkspaceMembership(input.workspaceId, ctx.user.id);
        const database = requireDb(await db.getDb());
        const rows = await database
          .select()
          .from(credentialEgressLog)
          .where(eq(credentialEgressLog.workspaceId, input.workspaceId))
          .orderBy(desc(credentialEgressLog.createdAt))
          .limit(input.limit);
        return { egress: rows };
      }),

    /**
     * Make an upstream provider call on the agent's behalf.
     *
     * Every security decision lives in authorizeBrokeredRequest() (pure and
     * unit-tested); this procedure is the I/O around it. Order matters: we
     * authorize, then claim the ledger record via a unique-index insert, and
     * only then decrypt the secret and make the call. Claiming before calling
     * is what makes replay impossible even under concurrent requests — two
     * racing calls with the same ledgerId cannot both win the insert.
     */
    broker: protectedProcedure
      .input(
        workspaceInput.extend({
          credentialId: z.string().min(1).max(64),
          ledgerId: z.string().min(1).max(64),
          method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("POST"),
          targetUrl: z.string().url().max(2048),
          headers: z.record(z.string(), z.string()).optional(),
          body: z.unknown().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await requireWorkspaceMembership(input.workspaceId, ctx.user.id);
        assertRuntimeApiKeyScope(ctx.user, input.workspaceId, "agent:execute");
        const database = requireDb(await db.getDb());

        const [credentialRow] = await database
          .select()
          .from(brokeredCredentials)
          .where(eq(brokeredCredentials.id, input.credentialId))
          .limit(1);
        const [ledgerRow] = await database
          .select()
          .from(actionLedger)
          .where(eq(actionLedger.id, input.ledgerId))
          .limit(1);

        const authorized = authorizeBrokeredRequest({
          workspaceId: input.workspaceId,
          targetUrl: input.targetUrl,
          ledger: ledgerRow
            ? {
                id: ledgerRow.id,
                workspaceId: ledgerRow.workspaceId,
                semanticAction: ledgerRow.semanticAction,
                decision: ledgerRow.decision,
                effectiveDecision: ledgerRow.effectiveDecision,
                occurredAt: ledgerRow.occurredAt,
              }
            : null,
          credential: credentialRow
            ? {
                id: credentialRow.id,
                workspaceId: credentialRow.workspaceId,
                status: credentialRow.status,
                allowedActions: (credentialRow.allowedActions as string[]) ?? [],
                allowedOrigin: credentialRow.allowedOrigin,
                injection: credentialRow.injection as CredentialInjection,
                headerName: credentialRow.headerName,
              }
            : null,
        });

        if (!authorized.allowed) {
          logSecurityEvent(
            "credential_broker_denied",
            {
              reasons: authorized.reasons,
              credentialId: input.credentialId,
              ledgerId: input.ledgerId,
              workspaceId: input.workspaceId,
            },
            { userId: ctx.user.id },
          );
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Brokered call refused: ${authorized.reasons.join(", ")}`,
          });
        }

        // Claim the ledger record before spending the credential. The unique
        // index on ledger_id turns a duplicate into a DB error rather than a
        // second privileged call.
        const egressId = id("egr");
        try {
          await database.insert(credentialEgressLog).values({
            id: egressId,
            workspaceId: input.workspaceId,
            credentialId: input.credentialId,
            ledgerId: input.ledgerId,
            agentId: ledgerRow!.agentId,
            semanticAction: ledgerRow!.semanticAction,
            method: input.method,
            targetUrl: input.targetUrl,
          });
        } catch {
          logSecurityEvent(
            "credential_broker_replay_blocked",
            { ledgerId: input.ledgerId, workspaceId: input.workspaceId },
            { userId: ctx.user.id },
          );
          throw new TRPCError({
            code: "CONFLICT",
            message: "This authorization has already been used for a brokered call",
          });
        }

        const secret = decryptSecret(
          credentialRow!.secretCiphertext,
          String(input.workspaceId),
        );

        try {
          const result = await executeBrokeredCall({
            targetUrl: input.targetUrl,
            method: input.method,
            secret,
            injection: credentialRow!.injection as CredentialInjection,
            headerName: credentialRow!.headerName,
            headers: input.headers,
            body: input.body,
          });
          await database
            .update(credentialEgressLog)
            .set({ responseStatus: result.status, durationMs: result.durationMs })
            .where(eq(credentialEgressLog.id, egressId));
          await database
            .update(brokeredCredentials)
            .set({ lastUsedAt: new Date() })
            .where(eq(brokeredCredentials.id, input.credentialId));
          return {
            status: result.status,
            headers: result.headers,
            // Defence in depth: providers sometimes echo the key back in an
            // error body, and that must not reach the agent or our log.
            body: redactSecret(result.body, secret),
            durationMs: result.durationMs,
            egressId,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "upstream call failed";
          await database
            .update(credentialEgressLog)
            .set({ error: message.slice(0, 1000) })
            .where(eq(credentialEgressLog.id, egressId));
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Upstream provider call failed: ${message}`,
          });
        }
      }),
  }),
});
