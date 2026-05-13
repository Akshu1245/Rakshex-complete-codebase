/**
 * MCP Governance — read + mutation endpoints.
 *
 * Full lifecycle: register → discover → approve/deny → invoke → audit.
 * Uses the MCP transport layer in services/mcpTransport to connect to
 * real MCP servers over stdio, streamable-http, or SSE.
 */
import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and } from "drizzle-orm";
import {
  mcpServers,
  mcpTools,
  mcpInvocationLog,
} from "../../drizzle/schema";
import {
  discoverMcpTools,
  classifyToolRisk,
  type McpTransport,
} from "../services/mcpTransport";
import { logger } from "../_core/logger";
import { TRPCError } from "@trpc/server";

export const mcpGovernanceRouter = router({
  // List all MCP servers registered to the current user.
  listServers: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { servers: [] };
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.userId, ctx.user.id))
      .orderBy(desc(mcpServers.discoveredAt));
    return { servers: rows };
  }),

  // List tools exposed by a server, with their risk classification.
  listTools: protectedProcedure
    .input(z.object({ serverId: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { tools: [] };
      // Verify the server belongs to this user (BOLA prevention).
      const owner = await db
        .select({ id: mcpServers.id })
        .from(mcpServers)
        .where(
          and(
            eq(mcpServers.id, input.serverId),
            eq(mcpServers.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (owner.length === 0) return { tools: [] };
      const rows = await db
        .select()
        .from(mcpTools)
        .where(eq(mcpTools.serverId, input.serverId));
      return { tools: rows };
    }),

  // Recent invocation log — drives the "permission graph" view's audit pane.
  recentInvocations: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(500).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { invocations: [] };
      const rows = await db
        .select()
        .from(mcpInvocationLog)
        .where(eq(mcpInvocationLog.userId, ctx.user.id))
        .orderBy(desc(mcpInvocationLog.createdAt))
        .limit(input.limit);
      return { invocations: rows };
    }),

  // Aggregate stats for the governance dashboard tile.
  summary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return {
        totalServers: 0,
        activeServers: 0,
        unsafeTools: 0,
        invocations24h: 0,
      };
    }
    // 1. Server counts.
    const allServers = await db
      .select({ id: mcpServers.id, isActive: mcpServers.isActive })
      .from(mcpServers)
      .where(eq(mcpServers.userId, ctx.user.id));
    const totalServers = allServers.length;
    const activeServers = allServers.filter(s => s.isActive).length;

    // 2. Unsafe-tool counts (joined to keep it user-scoped).
    const userServerIds = allServers.map(s => s.id);
    let unsafeTools = 0;
    if (userServerIds.length > 0) {
      // Drizzle's `inArray` from drizzle-orm — we use a manual filter to
      // avoid pulling another import for a single use.
      for (const serverId of userServerIds) {
        const unsafeRows = await db
          .select({ id: mcpTools.id })
          .from(mcpTools)
          .where(
            and(
              eq(mcpTools.serverId, serverId),
              eq(mcpTools.riskClass, "unsafe")
            )
          );
        unsafeTools += unsafeRows.length;
      }
    }

    // 3. Last-24h invocation count.
    // We rely on JS-side filtering since Drizzle can't easily do
    // "last 24 hours" in our MySQL dialect without a subquery; volume here
    // is small (an individual user's invocation log).
    const recent = await db
      .select({ createdAt: mcpInvocationLog.createdAt })
      .from(mcpInvocationLog)
      .where(eq(mcpInvocationLog.userId, ctx.user.id));
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const invocations24h = recent.filter(
      r => r.createdAt && r.createdAt.getTime() >= cutoff
    ).length;

    return {
      totalServers,
      activeServers,
      unsafeTools,
      invocations24h,
    };
  }),

  // ── Mutations ──────────────────────────────────────────────────────────

  /** Register an MCP server and discover its tools. */
  registerServer: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        url: z.string().url().optional(),
        transport: z.enum(["stdio", "streamable-http", "sse"]),
        command: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const serverId = `mcp_${crypto.randomBytes(12).toString("hex")}`;

      await db.insert(mcpServers).values({
        id: serverId,
        userId: ctx.user.id,
        name: input.name,
        url: input.url ?? null,
        transport: input.transport,
        riskScore: 0,
        isActive: true,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      });

      // Discover tools from the MCP server
      let tools: Array<{
        name: string;
        description?: string;
        inputSchema: Record<string, unknown>;
      }> = [];

      try {
        const result = await discoverMcpTools(
          input.transport,
          input.url ?? "",
          input.command
        );
        tools = result.tools;

        // Update server name from discovery if available
        if (result.server.name && result.server.name !== input.name) {
          await db
            .update(mcpServers)
            .set({
              capabilityFingerprint: {
                serverName: result.server.name,
                serverVersion: result.server.version,
                toolCount: tools.length,
                tools: tools.map(t => t.name),
              },
              lastSeenAt: new Date(),
            })
            .where(eq(mcpServers.id, serverId));
        }
      } catch (err) {
        logger.warn({ err, serverId }, "[MCP] tool discovery failed");
        // Server is registered but tools list will be empty — user can
        // re-discover later.
      }

      // Persist discovered tools
      let riskScore = 0;
      for (const tool of tools) {
        const riskClass = classifyToolRisk(tool);
        const toolId = `mcp_t_${crypto.randomBytes(8).toString("hex")}`;

        await db.insert(mcpTools).values({
          id: toolId,
          serverId,
          name: tool.name,
          description: tool.description ?? null,
          riskClass,
          inputSchema: tool.inputSchema ?? {},
          isApproved: riskClass === "safe", // auto-approve safe tools
          createdAt: new Date(),
        });

        if (riskClass === "unsafe") riskScore += 10;
        else if (riskClass === "elevated") riskScore += 5;
      }

      // Update risk score based on tool classification
      if (riskScore > 0) {
        await db
          .update(mcpServers)
          .set({ riskScore })
          .where(eq(mcpServers.id, serverId));
      }

      return {
        serverId,
        toolCount: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          riskClass: classifyToolRisk(t),
        })),
      };
    }),

  /** Re-discover tools for an existing server. */
  discoverTools: protectedProcedure
    .input(z.object({ serverId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const server = await db
        .select()
        .from(mcpServers)
        .where(
          and(
            eq(mcpServers.id, input.serverId),
            eq(mcpServers.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (server.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const srv = server[0];
      let tools: Array<{
        name: string;
        description?: string;
        inputSchema: Record<string, unknown>;
      }> = [];

      try {
        const result = await discoverMcpTools(
          srv.transport as McpTransport,
          srv.url ?? "",
        );
        tools = result.tools;

        await db
          .update(mcpServers)
          .set({
            capabilityFingerprint: {
              serverName: result.server.name,
              serverVersion: result.server.version,
              toolCount: tools.length,
              tools: tools.map(t => t.name),
            },
            lastSeenAt: new Date(),
          })
          .where(eq(mcpServers.id, input.serverId));
      } catch (err) {
        logger.warn({ err, serverId: input.serverId }, "[MCP] rediscovery failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to connect: ${(err as Error).message}`,
        });
      }

      // Upsert tools (delete old, insert new)
      await db
        .delete(mcpTools)
        .where(eq(mcpTools.serverId, input.serverId));

      let riskScore = 0;
      for (const tool of tools) {
        const riskClass = classifyToolRisk(tool);
        const toolId = `mcp_t_${crypto.randomBytes(8).toString("hex")}`;

        await db.insert(mcpTools).values({
          id: toolId,
          serverId: input.serverId,
          name: tool.name,
          description: tool.description ?? null,
          riskClass,
          inputSchema: tool.inputSchema ?? {},
          isApproved: riskClass === "safe",
          createdAt: new Date(),
        });

        if (riskClass === "unsafe") riskScore += 10;
        else if (riskClass === "elevated") riskScore += 5;
      }

      if (riskScore > 0) {
        await db
          .update(mcpServers)
          .set({ riskScore })
          .where(eq(mcpServers.id, input.serverId));
      }

      return { toolCount: tools.length };
    }),

  /** Toggle server active/inactive. */
  toggleServer: protectedProcedure
    .input(
      z.object({
        serverId: z.string().min(1).max(64),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const server = await db
        .select({ id: mcpServers.id })
        .from(mcpServers)
        .where(
          and(
            eq(mcpServers.id, input.serverId),
            eq(mcpServers.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (server.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db
        .update(mcpServers)
        .set({ isActive: input.isActive })
        .where(eq(mcpServers.id, input.serverId));

      return { success: true };
    }),

  /** Approve or unapprove a tool. */
  toggleToolApproval: protectedProcedure
    .input(
      z.object({
        toolId: z.string().min(1).max(64),
        isApproved: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tool = await db
        .select({ id: mcpTools.id, serverId: mcpTools.serverId })
        .from(mcpTools)
        .where(eq(mcpTools.id, input.toolId))
        .limit(1);

      if (tool.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify owner
      const server = await db
        .select({ id: mcpServers.id })
        .from(mcpServers)
        .where(
          and(
            eq(mcpServers.id, tool[0].serverId),
            eq(mcpServers.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (server.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db
        .update(mcpTools)
        .set({ isApproved: input.isApproved })
        .where(eq(mcpTools.id, input.toolId));

      return { success: true };
    }),
});
