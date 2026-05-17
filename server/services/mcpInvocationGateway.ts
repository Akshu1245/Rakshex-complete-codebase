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
  "exec",
  "shell",
  "bash",
  "eval",
  "spawn",
  "kill",
  "delete",
  "remove",
  "rm",
  "drop",
  "truncate",
  "sudo",
  "admin",
  "root",
  "write",
  "create",
  "update",
  "modify",
  "grant",
  "revoke",
];

function isToolRisky(toolName: string, args: Record<string, unknown>): boolean {
  const name = toolName.toLowerCase();
  if (RISKY_KEYWORDS.some((k) => name.includes(k))) return true;
  const argStr = JSON.stringify(args).toLowerCase();
  return RISKY_KEYWORDS.some((k) => argStr.includes(`"${k}`));
}

/* ─── Main gateway ─────────────────────────────────────────────────────── */

export async function invokeMCPTool(req: InvocationRequest): Promise<InvocationResult> {
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
      "[MCP Gateway] approved-but-risky tool invocation",
    );
  }

  // 3. Invoke the tool via the appropriate transport
  try {
    const result = await executeToolCall(
      serverRow.url || "",
      serverRow.transport as "stdio" | "streamable-http",
      req.toolName,
      req.args,
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

/**
 * Hardened URL validation to prevent SSRF.
 * Blocks: localhost, loopback (IPv4 + IPv6), private ranges,
 * link-local, decimal/octal/hex encoded IPs, and empty/zero hosts.
 */
export function validateMcpUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`MCP servers must use HTTPS: got ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("MCP server URLs must not point to private/internal addresses");
  }

  // Block empty / zero hosts
  if (hostname === "" || hostname === "0.0.0.0") {
    throw new Error("MCP server URLs must not point to private/internal addresses");
  }

  // Block IPv6 loopback and link-local
  if (
    hostname === "::1" ||
    hostname === "0:0:0:0:0:0:0:1" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0001" ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd")
  ) {
    throw new Error("MCP server URLs must not point to private/internal addresses");
  }

  // Block IPv4 private + link-local ranges
  if (
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error("MCP server URLs must not point to private/internal addresses");
  }

  // Block decimal/octal/hex encoded IPv4 (e.g. 2130706433 = 127.0.0.1)
  // Pure numeric hostname or with 0x/00 prefix
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^0[0-7]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    throw new Error("MCP server URLs must not point to private/internal addresses");
  }

  // Block IPv4 addresses with fewer than 4 octets (e.g. 127.1 or 0177.0.0.01)
  const ipv4Pattern = /^(\d{1,3}\.){1,3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    const parts = hostname.split(".");
    const octets = parts.map((p) => {
      // Strip leading zeros to catch octal tricks, then parse
      const clean = p.replace(/^0+/, "") || "0";
      return parseInt(clean, 10);
    });
    // If any octet is loopback/private after normalization, block
    if (
      octets[0] === 127 ||
      octets[0] === 10 ||
      octets[0] === 0 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    ) {
      throw new Error("MCP server URLs must not point to private/internal addresses");
    }
  }

  // Block URL-encoded variants that might bypass hostname checks
  if (/%/.test(hostname)) {
    throw new Error("MCP server URLs must not contain encoded characters in hostname");
  }
}

async function executeToolCall(
  url: string,
  transport: "stdio" | "streamable-http",
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (transport === "streamable-http") {
    validateMcpUrl(url);
    return executeHttpToolCall(url, toolName, args);
  }
  // stdio transport requires command execution via spawn — not yet implemented.
  // After RCE-001 fix, stdio commands are validated but actual invocation
  // needs a secured subprocess wrapper (tracked as future work).
  throw new Error("stdio tool invocation is not yet implemented — use streamable-http");
}

async function executeHttpToolCall(
  url: string,
  toolName: string,
  args: Record<string, unknown>,
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
      `MCP tool call failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`MCP tool error: ${data.error.message}`);
  }

  return data.result?.content ?? data.result ?? { ok: true };
}
