/**
 * Projects, repositories, and environments (PROMPT 4 resource model).
 */
import crypto from "crypto";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { projects, repositories, environments } from "@rakshex/database";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import * as db from "../db";
import { requireWorkspacePermission } from "../services/authorization";

function secureId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const ENV_DEFAULTS: Array<{
  kind: "development" | "staging" | "production";
  name: string;
  slug: string;
}> = [
  { kind: "development", name: "Development", slug: "development" },
  { kind: "staging", name: "Staging", slug: "staging" },
  { kind: "production", name: "Production", slug: "production" },
];

export const projectsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "projects", "read");
      const driver = await getDb();
      if (!driver) return [];
      return driver
        .select()
        .from(projects)
        .where(and(eq(projects.workspaceId, input.workspaceId), isNull(projects.deletedAt)));
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        name: z.string().min(1).max(192),
        slug: z.string().max(64).optional(),
        description: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "projects", "write");
      const driver = await getDb();
      if (!driver)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const slug = slugify(input.slug || input.name) || "project";
      const id = secureId("proj");
      await driver.insert(projects).values({
        id,
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
      });

      // Seed default environments for the project
      for (const env of ENV_DEFAULTS) {
        await driver.insert(environments).values({
          id: secureId("env"),
          workspaceId: input.workspaceId,
          projectId: id,
          name: env.name,
          kind: env.kind,
          slug: `${slug}-${env.slug}`.slice(0, 64),
        });
      }

      await db.createAuditLogEntry(
        ctx.user.id,
        "project_created",
        { projectId: id, workspaceId: input.workspaceId },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      const rows = await driver.select().from(projects).where(eq(projects.id, id)).limit(1);
      return rows[0];
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        projectId: z.string().min(1),
        name: z.string().min(1).max(192).optional(),
        description: z.string().max(2000).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "projects", "write");
      const driver = await getDb();
      if (!driver)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const existing = await driver
        .select()
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, input.workspaceId)))
        .limit(1);
      if (!existing[0] || existing[0].deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      await driver
        .update(projects)
        .set({
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, input.projectId));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        projectId: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "projects", "delete");
      const driver = await getDb();
      if (!driver)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await driver
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, input.workspaceId)));

      await db.createAuditLogEntry(
        ctx.user.id,
        "project_deleted",
        { projectId: input.projectId, workspaceId: input.workspaceId },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );
      return { success: true };
    }),

  listRepositories: protectedProcedure
    .input(z.object({ workspaceId: z.number().int().positive(), projectId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "repositories", "read");
      const driver = await getDb();
      if (!driver) return [];
      const conditions = [
        eq(repositories.workspaceId, input.workspaceId),
        isNull(repositories.deletedAt),
      ];
      if (input.projectId) {
        conditions.push(eq(repositories.projectId, input.projectId));
      }
      return driver
        .select()
        .from(repositories)
        .where(and(...conditions));
    }),

  addRepository: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        projectId: z.string().optional(),
        fullName: z.string().min(1).max(255),
        provider: z.string().max(32).default("github"),
        defaultBranch: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "repositories", "write");
      const driver = await getDb();
      if (!driver)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const id = secureId("repo");
      await driver.insert(repositories).values({
        id,
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        fullName: input.fullName,
        provider: input.provider,
        defaultBranch: input.defaultBranch ?? "main",
      });

      await db.createAuditLogEntry(
        ctx.user.id,
        "repository_added",
        { repositoryId: id, workspaceId: input.workspaceId, fullName: input.fullName },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      const rows = await driver.select().from(repositories).where(eq(repositories.id, id)).limit(1);
      return rows[0];
    }),

  listEnvironments: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int().positive(),
        projectId: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      await requireWorkspacePermission(input.workspaceId, ctx.user.id, "projects", "read");
      const driver = await getDb();
      if (!driver) return [];
      const conditions = [
        eq(environments.workspaceId, input.workspaceId),
        isNull(environments.deletedAt),
      ];
      if (input.projectId) {
        conditions.push(eq(environments.projectId, input.projectId));
      }
      return driver
        .select()
        .from(environments)
        .where(and(...conditions));
    }),
});
