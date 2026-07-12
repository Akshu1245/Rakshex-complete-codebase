import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { sendTeamInviteEmail } from "../email";
import { logger } from "../_core/logger";

export const teamRouter = router({
  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["admin", "editor", "viewer"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getTeamMemberByEmail(ctx.user.id, input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation has already been sent to this email address",
        });
      }

      const member = await db.inviteTeamMember(ctx.user.id, input.email, input.role);

      await sendTeamInviteEmail({
        toEmail: input.email,
        inviterName: ctx.user.name ?? "A Rakshex user",
        role: input.role,
        token: member.id,
      }).catch((err) => logger.warn({ err: err }, "[Team] Email send failed"));

      return { success: true, memberId: member.id };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const members = await db.getTeamMembersByUserId(ctx.user.id);
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const total = members.length;
      const paginated = members.slice((page - 1) * pageSize, page * pageSize);

      return {
        members: paginated.map((m) => ({
          id: m.id,
          email: m.memberEmail,
          role: m.role,
          status: m.status,
          invitedAt: m.invitedAt,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        memberId: z.string(),
        role: z.enum(["admin", "editor", "viewer"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.memberId);
      if (!member || member.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found or access denied",
        });
      }
      await db.updateTeamMemberRole(input.memberId, input.role);

      // If the member has accepted the invitation and has a user account,
      // invalidate all their sessions so they must re-authenticate with the new role.
      if (member.memberUserId) {
        await db.revokeAllUserSessions(member.memberUserId);
      }

      await db.createAuditLogEntry(ctx.user.id, "team_role_updated", {
        memberId: input.memberId,
        role: input.role,
      });
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.memberId);
      if (!member || member.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found or access denied",
        });
      }
      await db.removeTeamMember(input.memberId);
      await db.createAuditLogEntry(ctx.user.id, "team_member_removed", {
        memberId: input.memberId,
      });
      return { success: true };
    }),

  resendInvite: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.memberId);
      if (!member || member.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found or access denied",
        });
      }
      await sendTeamInviteEmail({
        toEmail: member.memberEmail,
        inviterName: ctx.user.name ?? "A Rakshex user",
        role: member.role,
      }).catch((err) => logger.warn({ err: err }, "[Team] Email send failed"));
      return { success: true };
    }),

  acceptInvitation: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.memberId);
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }
      if (member.memberEmail !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not for your email address",
        });
      }
      if (member.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer pending",
        });
      }
      await db.acceptTeamInvitation(input.memberId, ctx.user.id);
      return { success: true };
    }),

  rejectInvitation: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.memberId);
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }
      if (member.memberEmail !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not for your email address",
        });
      }
      if (member.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer pending",
        });
      }
      await db.rejectTeamInvitation(input.memberId);
      return { success: true };
    }),

  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.email) return { invitations: [] };
    const invitations = await db.getPendingInvitationsForUser(ctx.user.email);
    return {
      invitations: invitations.map((inv) => ({
        id: inv.id,
        role: inv.role,
        invitedAt: inv.invitedAt,
      })),
    };
  }),

  getInvitationByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const member = await db.getTeamMemberById(input.token);
      if (!member || member.status !== "pending") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found or expired",
        });
      }

      const inviter = await db.getUserById(member.userId);
      if (!inviter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inviter not found",
        });
      }

      return {
        memberId: member.id,
        workspaceName: inviter.name || inviter.email || "Rakshex Workspace",
        inviterName: inviter.name || inviter.email || "A Rakshex user",
        inviterEmail: inviter.email,
        role: member.role,
        invitedAt: member.invitedAt,
      };
    }),

  acceptInvitationByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.token);
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }
      if (member.memberEmail !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not for your email address",
        });
      }
      if (member.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer pending",
        });
      }

      await db.acceptTeamInvitation(input.token, ctx.user.id);
      return { success: true };
    }),

  declineInvitationByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await db.getTeamMemberById(input.token);
      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }
      if (member.memberEmail !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not for your email address",
        });
      }
      if (member.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer pending",
        });
      }

      await db.rejectTeamInvitation(input.token);
      return { success: true };
    }),
});
