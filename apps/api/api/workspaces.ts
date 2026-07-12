/**
 * Workspaces + RBAC tRPC router (Sprint 6 / Domain 6).
 *
 * Endpoints:
 *  - listMine            — every workspace the caller is a member of
 *  - getCurrent          — pull the canonical "active" workspace and its role
 *  - create              — make a new workspace; caller becomes owner
 *  - update              — rename, requires admin
 *  - delete              — full teardown, requires owner; refuses personal
 *  - listMembers         — members + roles, requires members:read
 *  - inviteMember        — issue an invitation token, requires members:write
 *  - listInvitations     — pending invites for a workspace
 *  - cancelInvitation    — admin-only
 *  - acceptInvitation    — public; consumes a token + auto-joins the user
 *  - updateMemberRole    — change a member's role, requires members:write
 *  - removeMember        — leave / kick, requires members:delete OR self
 *  - myPermissions       — UI-gating helper: { role, permissions }
 */

import crypto from "crypto";
import { z } from "zod";

import * as db from "../db";
import type { WorkspaceRow } from "@rakshex/database";
import { ValidationError } from "../_core/errors";
import { protectedProcedure, router } from "../_core/trpc";
import { type WorkspaceRole, PermissionDeniedError, summarisePermissions } from "../services/rbac";
import {
  assertWorkspacePermission,
  getWorkspaceRole,
  invalidateMembershipCache,
} from "../services/workspaceContext";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

const roleEnumWritable = z.enum(["admin", "editor", "viewer"]);

function normaliseSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function uniqueSlug(base: string): Promise<string> {
  const baseSlug = normaliseSlug(base) || "workspace";
  if (!(await db.getWorkspaceBySlug(baseSlug))) return baseSlug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${baseSlug}-${i}`.slice(0, 64);
    if (!(await db.getWorkspaceBySlug(candidate))) return candidate;
  }
  // Pathological fall-through — append random suffix.
  return `${baseSlug}-${crypto.randomBytes(3).toString("hex")}`.slice(0, 64);
}

export const workspacesRouter = router({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    return db.listWorkspacesForUser(ctx.user.id);
  }),

  getCurrent: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const role = await getWorkspaceRole(input.workspaceId, ctx.user.id);
      if (!role) {
        throw new ValidationError("not a member of this workspace");
      }
      const workspace = await db.getWorkspaceById(input.workspaceId);
      return { workspace, role };
    }),

  myPermissions: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const role = await getWorkspaceRole(input.workspaceId, ctx.user.id);
      if (!role) return null;
      return summarisePermissions(role);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(192),
        slug: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug ? normaliseSlug(input.slug) : await uniqueSlug(input.name);
      if (!SLUG_RE.test(slug)) {
        throw new ValidationError("slug must be 1-64 chars, lowercase letters, digits, dashes");
      }
      if (await db.getWorkspaceBySlug(slug)) {
        throw new ValidationError("a workspace with this slug already exists");
      }
      const id = await db.createWorkspace({
        slug,
        name: input.name.trim(),
        ownerUserId: ctx.user.id,
        isPersonal: false,
      });
      await db.addWorkspaceMember({
        workspaceId: id,
        userId: ctx.user.id,
        role: "owner",
        active: true,
        joinedAt: new Date(),
      });
      return { id, slug };
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        name: z.string().min(1).max(192).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "workspace", "write");
      const patch: Partial<WorkspaceRow> = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (Object.keys(patch).length === 0) return { ok: true };
      await db.updateWorkspace(input.workspaceId, patch);
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "workspace", "delete");
      const ws = await db.getWorkspaceById(input.workspaceId);
      if (ws?.isPersonal) {
        throw new ValidationError(
          "cannot delete your personal workspace; you can rename or leave others",
        );
      }
      await db.deleteWorkspace(input.workspaceId);
      return { ok: true };
    }),

  listMembers: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "members", "read");
      return db.listWorkspaceMembers(input.workspaceId);
    }),

  inviteMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        email: z.string().email().max(320),
        role: roleEnumWritable.default("viewer"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "members", "write");
      const token = crypto.randomBytes(24).toString("base64url");
      const id = await db.createWorkspaceInvitation({
        workspaceId: input.workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        token,
        invitedBy: ctx.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });
      return { id, token };
    }),

  listInvitations: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "members", "read");
      return db.listWorkspaceInvitations(input.workspaceId);
    }),

  cancelInvitation: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        invitationId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspacePermission(input.workspaceId, ctx.user.id, "members", "delete");
      await db.deleteWorkspaceInvitation(input.invitationId);
      return { ok: true };
    }),

  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const inv = await db.getWorkspaceInvitationByToken(input.token);
      if (!inv) throw new ValidationError("invitation not found");
      if (inv.expiresAt.getTime() < Date.now()) {
        await db.deleteWorkspaceInvitation(inv.id);
        throw new ValidationError("invitation expired");
      }
      const userEmail = ctx.user.email?.toLowerCase();
      if (userEmail && userEmail !== inv.email) {
        throw new ValidationError("this invitation was sent to a different email address");
      }
      const existing = await db.getWorkspaceMembership(inv.workspaceId, ctx.user.id);
      if (existing) {
        await db.updateWorkspaceMember(inv.workspaceId, ctx.user.id, {
          role: inv.role,
          active: true,
        });
      } else {
        await db.addWorkspaceMember({
          workspaceId: inv.workspaceId,
          userId: ctx.user.id,
          role: inv.role,
          active: true,
          invitedBy: inv.invitedBy,
          invitedAt: inv.createdAt,
          joinedAt: new Date(),
        });
      }
      invalidateMembershipCache(inv.workspaceId, ctx.user.id);
      await db.deleteWorkspaceInvitation(inv.id);
      return { workspaceId: inv.workspaceId, role: inv.role };
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        userId: z.number().int().positive(),
        role: z.enum(["owner", "admin", "editor", "viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const callerRole = await assertWorkspacePermission(
        input.workspaceId,
        ctx.user.id,
        "members",
        "write",
      );
      // Only owners can promote to owner.
      if (input.role === "owner" && callerRole !== "owner") {
        throw new PermissionDeniedError("members", "write", callerRole);
      }
      const target = await db.getWorkspaceMembership(input.workspaceId, input.userId);
      if (!target) throw new ValidationError("member not found");
      // Owners can't be demoted except by themselves or another owner.
      if (target.role === "owner" && callerRole !== "owner") {
        throw new PermissionDeniedError("members", "write", callerRole);
      }
      await db.updateWorkspaceMember(input.workspaceId, input.userId, {
        role: input.role,
      });
      invalidateMembershipCache(input.workspaceId, input.userId);
      return { ok: true };
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        userId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Self-leave is always allowed (except for the last owner).
      const isSelf = input.userId === ctx.user.id;
      if (!isSelf) {
        await assertWorkspacePermission(input.workspaceId, ctx.user.id, "members", "delete");
      }
      const target = await db.getWorkspaceMembership(input.workspaceId, input.userId);
      if (!target) throw new ValidationError("member not found");
      if (target.role === "owner") {
        const members = await db.listWorkspaceMembers(input.workspaceId);
        const owners = members.filter((m) => m.role === "owner" && m.active);
        if (owners.length <= 1) {
          throw new ValidationError("cannot remove the last owner; transfer ownership first");
        }
      }
      await db.removeWorkspaceMember(input.workspaceId, input.userId);
      invalidateMembershipCache(input.workspaceId, input.userId);
      return { ok: true };
    }),
});
