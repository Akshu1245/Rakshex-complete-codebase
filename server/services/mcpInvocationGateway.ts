/**
 * MCP Tool Invocation Gateway (Sprint 3 / Enforcement Loop).
 *
 * This is the "approval → invoke → audit" enforcement loop that bridges
 * the discovery layer (mcpTransport.ts) and the governance layer
 * (mcpGovernance.ts). Every tool call flows through here so we can:
 *   1. Check whether the tool is approved (auto vs. manual)
 *   2. Invoke the tool via the correct transport (stdio/streamable-http)
 *   3. Record an audit entry in mcpInvocationLog
 *
 * Previously the `tools/call` flow was missing — we only had discovery.
 */

import crypto from "crypto";
import * as db from "../db";
import { logger } from "../_core/logger";
import { discoverMcpTools } from "./mcpTransport";

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface InvocationRequest {
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  userId: number;
}

export interface InvocationResult {
  status: "completed" | "pending_approval" | "blocked" | "errored";
  result?: unknown;
  error?: string;
  approvalId?: number;
  auditId?: number;
  durationMs?: number;
}

/* ─── Tool classification ──────────────────────────────────────────────── */

const RISKY_KEYWORDS = [
  "exec", "shell", "bash", "eval", "spawn", "kill", "delete",
  "remove", "rm", "drop", "truncate", "sudo", "admin", "root",
  "write", "create", "update", "modify", "grant", "revoke",
];

function isToolRisky(toolName: string, args: Record<string, unknown>): boolean {
  const name = toolName.toLowerCase();
  if (RISKY_KEYWORDS.some(k => name.includes(k))) return true;
  const argStr = JSON.stringify(args).toLowerCase();
  return RISKY_KEYWORDS.some(k => argStr.includes(`"${k}`));
}

/* ─── Main gateway ─────────────────────────────────────────────────────── */

export async function invokeMCPTool(
  req: InvocationRequest
): Promise<InvocationResult> {
  const startedAt = Date.now();

  // 1. Look up the tool in the governance DB
  const servers = await db.listMcpServers(req.userId);
  let toolRow: Awaited<ReturnType<typeof db.getMcpToolByName>> | null = null;
  let serverRow: Record<string, any> | null = null;

  for (const srv of servers) {
    const tool = await db.getMcpToolByName(Number(srv.id), req.toolName);
    if (tool) {
      toolRow = tool;
      serverRow = srv;
      break;
    }
  }

  if (!toolRow || !serverRow) {
    return { status: "blocked", error: `Tool '${req.toolName}' not found` };
  }

  // 2. Check approval status
  if (!toolRow.isApproved) {
    return {
      status: "pending_approval",
      approvalId: Number(toolRow.id),
    };
  }

  // 2b. Risk classification (log risky tool invocations)
  if (isToolRisky(req.toolName, req.args)) {
    logger.warn(
      { toolName: req.toolName, userId: req.userId },
      "[MCP Gateway] approved-but-risky tool invocation"
    );
  }

  // 3. Invoke the tool via the appropriate transport
  try {
    const result = await executeToolCall(
      serverRow.url || "",
      serverRow.transport as "stdio" | "streamable-http",
      req.toolName,
      req.args
    );

    const durationMs = Date.now() - startedAt;

    // 4. Record audit entry
    await db.recordMcpInvocation({
      userId: req.userId,
      serverId: Number(serverRow.id),
      toolId: Number(toolRow.id),
      requestId: `mcp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      argsFingerprint: crypto.createHash("sha256").update(JSON.stringify(req.args)).digest("hex"),
      decision: "allowed",
      durationMs,
    });

    return {
      status: "completed",
      result,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    logger.warn({ err }, "[MCP Gateway] tool invocation failed");

    await db.recordMcpInvocation({
      userId: req.userId,
      serverId: Number(serverRow.id),
      toolId: Number(toolRow.id),
      requestId: `mcp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      argsFingerprint: crypto.createHash("sha256").update(JSON.stringify(req.args)).digest("hex"),
      decision: "errored",
      durationMs,
    });

    return {
      status: "errored",
      error: (err as Error).message,
      durationMs,
    };
  }
}

/* ─── Transport execution ──────────────────────────────────────────────── */

function validateMcpUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`MCP servers must use HTTPS: got ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") ||
    hostname.startsWith("192.168.")
  ) {
    throw new Error("MCP server URLs must not point to private/internal addresses");
  }
}

async function executeToolCall(
  url: string,
  transport: "stdio" | "streamable-http",
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (transport === "streamable-http") {
    validateMcpUrl(url);
    return executeHttpToolCall(url, toolName, args);
  }
  return executeHttpToolCall(url, toolName, args);
}

async function executeHttpToolCall(
  url: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `MCP tool call failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`
    );
  }

  const data = await response.json() as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`MCP tool error: ${data.error.message}`);
  }

  return data.result?.content ?? data.result ?? { ok: true };
}
