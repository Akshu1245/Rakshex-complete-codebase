/**
 * SSO management tRPC router (Sprint 6 / Domain 5).
 *
 * Surfaces CRUD for SSO provider configurations. Actual login flow
 * (authorize/callback redirects) is wired in server/sso/routes.ts as
 * Express handlers because tRPC isn't the right transport for HTML
 * redirects + 302s.
 *
 * Endpoints:
 *   - listProviders / getProvider / createProvider / updateProvider /
 *     setEnabled / deleteProvider
 *   - resolveByEmailDomain — used by the dashboard's "Login with SSO"
 *     box to auto-route a typed email to the matching provider's login.
 */

import { z } from "zod";

import * as db from "../db";
import type { SsoProviderRow } from "../../drizzle/schema";
import { ValidationError } from "../_core/errors";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const oidcConfigSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1).max(256),
  clientSecret: z.string().min(1).max(2048),
  scopes: z.string().max(512).optional(),
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
});

const samlConfigSchema = z.object({
  entryPoint: z.string().url(),
  issuer: z.string().min(1).max(512),
  audience: z.string().min(1).max(512),
  callbackUrl: z.string().url(),
  certificate: z.string().max(16_384).optional(),
  nameIdFormat: z.string().max(256).optional(),
});

const providerKindEnum = z.enum(["oidc", "saml"]);
const roleEnum = z.enum(["admin", "editor", "viewer"]);

export const ssoRouter = router({
  listProviders: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.listSsoProviders(ctx.user.id);
    return rows.map(redactSecrets);
  }),

  getProvider: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const row = await db.getSsoProviderForUser(ctx.user.id, input.id);
      if (!row) throw new ValidationError("provider not found");
      return redactSecrets(row);
    }),

  createProvider: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(192),
        kind: providerKindEnum,
        config: z.union([oidcConfigSchema, samlConfigSchema]),
        emailDomain: z.string().max(256).optional(),
        defaultRole: roleEnum.default("viewer"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      validateConfigForKind(input.kind, input.config);
      const id = await db.createSsoProvider({
        userId: ctx.user.id,
        name: input.name,
        kind: input.kind,
        enabled: false,
        config: input.config,
        emailDomain: input.emailDomain ?? null,
        defaultRole: input.defaultRole,
      });
      return { id };
    }),

  updateProvider: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(192).optional(),
        config: z.union([oidcConfigSchema, samlConfigSchema]).optional(),
        emailDomain: z.string().max(256).nullable().optional(),
        defaultRole: roleEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getSsoProviderForUser(ctx.user.id, input.id);
      if (!existing) throw new ValidationError("provider not found");
      if (input.config) {
        validateConfigForKind(existing.kind, input.config);
      }
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.config !== undefined) patch.config = input.config;
      if (input.emailDomain !== undefined)
        patch.emailDomain = input.emailDomain;
      if (input.defaultRole !== undefined) patch.defaultRole = input.defaultRole;
      await db.updateSsoProvider(ctx.user.id, input.id, patch);
      return { ok: true };
    }),

  setEnabled: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getSsoProviderForUser(ctx.user.id, input.id);
      if (!existing) throw new ValidationError("provider not found");
      await db.updateSsoProvider(ctx.user.id, input.id, {
        enabled: input.enabled,
      });
      return { ok: true };
    }),

  deleteProvider: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteSsoProvider(ctx.user.id, input.id);
      return { ok: true };
    }),

  /**
   * Public — feeds the login page's "Login with SSO" widget. Given an
   * email, find the first enabled provider whose emailDomain regex
   * matches. Returns the provider id + name so the page can redirect
   * to /auth/sso/<id>/login.
   *
   * No auth required because the user isn't signed in yet.
   *
   * Security: Only returns SSO providers that belong to the workspace
   * whose members include a user with a matching email domain. This
   * prevents leaking SSO provider existence across workspace boundaries.
   */
  resolveByEmailDomain: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const email = input.email.toLowerCase();
      const domain = email.split("@")[1];
      if (!domain) return null;

      // Look up workspaces that have members with the same email domain.
      // This scopes SSO provider visibility to the correct workspace(s)
      // rather than returning ALL providers across all workspaces.
      const workspaceOwnerIds = await db.getWorkspaceOwnerIdsByEmailDomain(domain);

      // If no matching workspaces found, return null (no providers to offer)
      if (workspaceOwnerIds.length === 0) return null;

      // Fetch SSO providers only for the matching workspace owners
      const allProviders: SsoProviderRow[] = [];
      for (const ownerId of workspaceOwnerIds) {
        const providers = await db.listSsoProviders(ownerId);
        allProviders.push(...providers);
      }

      const enabled = allProviders.filter(
        p => p.enabled && p.emailDomain && p.emailDomain.length > 0
      );
      for (const p of enabled) {
        try {
          if (new RegExp(p.emailDomain!, "i").test(email)) {
            return { id: p.id, name: p.name, kind: p.kind };
          }
        } catch {
          // bad regex — skip
        }
      }
      return null;
    }),
});

function validateConfigForKind(
  kind: "oidc" | "saml",
  config: unknown
): void {
  if (kind === "oidc") {
    const r = oidcConfigSchema.safeParse(config);
    if (!r.success) {
      throw new ValidationError(
        `OIDC config invalid: ${r.error.issues.map(i => i.message).join("; ")}`
      );
    }
  } else {
    const r = samlConfigSchema.safeParse(config);
    if (!r.success) {
      throw new ValidationError(
        `SAML config invalid: ${r.error.issues.map(i => i.message).join("; ")}`
      );
    }
  }
}

/**
 * Strip clientSecret + certificate before returning a provider row to the
 * client. Operators see "***configured***" so they know the secret is set
 * without us exposing it to anyone who can call listProviders.
 */
function redactSecrets(
  row: SsoProviderRow
): Omit<SsoProviderRow, "config"> & { config: Record<string, unknown> } {
  const cfg = (row.config as Record<string, unknown>) ?? {};
  const redacted: Record<string, unknown> = { ...cfg };
  if (typeof redacted.clientSecret === "string" && redacted.clientSecret) {
    redacted.clientSecret = "***configured***";
  }
  if (typeof redacted.certificate === "string" && redacted.certificate) {
    redacted.certificate = "***configured***";
  }
  return { ...row, config: redacted };
}
