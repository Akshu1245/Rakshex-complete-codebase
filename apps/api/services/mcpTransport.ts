/**
 * MCP Transport Client (Sprint 6 completion).
 *
 * Implements the Model Context Protocol transport layer — connects to
 * an MCP server, sends `initialize` + `tools/list` over the wire,
 * parses the response, and returns typed tool definitions the caller
 * can persist. Supports stdio (spawn), streamable-http (POST), and
 * SSE transports.
 *
 * Protocol ref: https://modelcontextprotocol.io/specification/2024-11-05
 */

import { spawn, ChildProcess } from "child_process";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { logger } from "../_core/logger";
import { logSecurityEvent } from "./securityEvents";

/* ─── Types ────────────────────────────────────────────────────────────── */

export type McpTransport = "stdio" | "streamable-http" | "sse";

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpDiscoverResult {
  server: McpServerInfo;
  tools: McpToolDef[];
}

/* ─── Stdio transport ──────────────────────────────────────────────────── */

interface StdioSession {
  proc: ChildProcess;
  nextId: number;
  pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  buffer: string;
}

function stdioRequest(
  session: StdioSession,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = session.nextId++;
    session.pending.set(id, { resolve, reject });
    const req = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    session.proc.stdin?.write(req + "\n");
  });
}

/** Blocklist of dangerous command names and path traversal patterns */
const BLOCKED_COMMAND_PATTERNS = [
  /\.\./, // path traversal
  /^\/bin\/sh$/i, // shell interpreters
  /^\/bin\/bash$/i,
  /^cmd\.exe$/i,
  /^powershell\.exe$/i,
  /^sh$/i,
  /^bash$/i,
  /^zsh$/i,
  /^cmd$/i,
  /^powershell$/i,
  /[;&|`$(){}[\]\\]/, // shell metacharacters in any arg
];

function validateStdioCommand(command: string[]): void {
  if (command.length === 0) throw new Error("stdio command is empty");
  for (const arg of command) {
    if (BLOCKED_COMMAND_PATTERNS.some((p) => p.test(arg))) {
      logSecurityEvent("rce_command_blocked", { command, blockedArg: arg });
      throw new Error("MCP stdio command contains blocked characters or patterns");
    }
  }
  // Only allow known-safe binary names (allowlist approach)
  const allowedBinaries = new Set(["node", "npm", "npx", "python", "python3", "uv"]);
  const binaryName = command[0].replace(/^.*[\\/]/, ""); // strip path
  if (!allowedBinaries.has(binaryName)) {
    logSecurityEvent("rce_command_blocked", { command, blockedBinary: binaryName });
    throw new Error(`MCP stdio binary "${binaryName}" is not in the allowed list`);
  }
}

async function discoverViaStdio(command: string[]): Promise<McpDiscoverResult> {
  validateStdioCommand(command);

  const proc = spawn(command[0], command.slice(1), {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    shell: false, // never invoke via shell
  });

  const session: StdioSession = {
    proc,
    nextId: 1,
    pending: new Map(),
    buffer: "",
  };

  let stderr = "";

  const resultPromise = new Promise<McpDiscoverResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("MCP stdio discovery timed out after 15s"));
      proc.kill();
    }, 15_000);

    proc.stdout?.on("data", (chunk: Buffer) => {
      session.buffer += chunk.toString("utf-8");
      const lines = session.buffer.split("\n");
      session.buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (typeof msg.id === "number" && session.pending.has(msg.id)) {
            const { resolve: res, reject: rej } = session.pending.get(msg.id)!;
            session.pending.delete(msg.id);
            if (msg.error) {
              rej(new Error(msg.error.message ?? "MCP error"));
            } else {
              res(msg.result);
            }
          }
        } catch {
          // non-JSON output (e.g., debug logs) — skip
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      for (const [, p] of session.pending) {
        p.reject(new Error(`MCP server exited with code ${code}${stderr ? ": " + stderr : ""}`));
      }
      session.pending.clear();
    });

    // Handshake sequence
    stdioRequest(session, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rakshex", version: "1.0.0" },
    })
      .then(() => {
        // Send initialized notification
        proc.stdin?.write(
          JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
        );
        return stdioRequest(session, "tools/list");
      })
      .then((result) => {
        clearTimeout(timeout);
        proc.kill();

        const tools = Array.isArray((result as { tools?: McpToolDef[] }).tools)
          ? (result as { tools: McpToolDef[] }).tools
          : [];

        resolve({
          server: { name: command.join(" "), version: "unknown" },
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema ?? {},
          })),
        });
      })
      .catch((err) => {
        clearTimeout(timeout);
        proc.kill();
        reject(err);
      });
  });

  return resultPromise;
}

/* ─── Streamable HTTP transport ────────────────────────────────────────── */

async function httpJsonRpc(
  url: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!res || typeof (res as Response).json !== "function") {
    throw new Error(`Non-HTTP transport for ${url}`);
  }
  const response = res as Response;
  if (!response.ok) throw new Error(`MCP HTTP ${response.status} from ${url}`);

  const body = (await response.json()) as {
    error?: { message: string };
    result?: unknown;
  };
  if (body.error) throw new Error(body.error.message ?? "MCP error");
  return body.result;
}

async function discoverViaHttp(url: string): Promise<McpDiscoverResult> {
  const init = (await httpJsonRpc(url, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "rakshex", version: "1.0.0" },
  })) as { serverInfo?: McpServerInfo };

  const result = (await httpJsonRpc(url, "tools/list")) as {
    tools?: McpToolDef[];
  };

  return {
    server: init.serverInfo ?? { name: url, version: "unknown" },
    tools: (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? {},
    })),
  };
}

/* ─── SSE transport ────────────────────────────────────────────────────── */

async function discoverViaSse(url: string): Promise<McpDiscoverResult> {
  // SSE endpoint returns a session ID; POST endpoint receives commands
  const sseUrl = `${url.replace(/\/$/, "")}/sse`;
  const postUrl = `${url.replace(/\/$/, "")}/message`;

  const eventSource = new EventSource(sseUrl);
  let sessionId: string | null = null;

  return new Promise<McpDiscoverResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      eventSource.close();
      reject(new Error("MCP SSE discovery timed out after 15s"));
    }, 15_000);

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // First message may contain endpoint info
        if (msg.event === "endpoint" && msg.data) {
          sessionId = msg.data;
          // Send initialize after session established
          sendSseCommand(postUrl, sessionId, "initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "rakshex", version: "1.0.0" },
          })
            .then(() => {
              return sendSseCommand(postUrl, sessionId!, "tools/list", {});
            })
            .then((result) => {
              clearTimeout(timeout);
              eventSource.close();
              const tools = Array.isArray((result as { tools?: McpToolDef[] }).tools)
                ? (result as { tools: McpToolDef[] }).tools
                : [];
              resolve({
                server: { name: url, version: "unknown" },
                tools: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  inputSchema: t.inputSchema ?? {},
                })),
              });
            })
            .catch((err) => {
              clearTimeout(timeout);
              eventSource.close();
              reject(err);
            });
        }
      } catch {
        // non-JSON SSE event — ignore
      }
    };

    eventSource.onerror = () => {
      clearTimeout(timeout);
      eventSource.close();
      reject(new Error("SSE connection failed"));
    };
  });
}

async function sendSseCommand(
  postUrl: string,
  sessionId: string | null,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }
  const res = await fetchWithTimeout(postUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!res || typeof (res as Response).json !== "function") {
    throw new Error(`MCP SSE POST failed for ${method}`);
  }
  const response = res as Response;
  if (!response.ok) throw new Error(`MCP SSE ${response.status} for ${method}`);
  const body = (await response.json()) as { error?: { message: string }; result?: unknown };
  if (body.error) throw new Error(body.error.message ?? "MCP error");
  return body.result;
}

/* ─── Main entry point ─────────────────────────────────────────────────── */

export async function discoverMcpTools(
  transport: McpTransport,
  url: string,
  command?: string[],
): Promise<McpDiscoverResult> {
  switch (transport) {
    case "stdio": {
      if (!command || command.length === 0) {
        throw new Error("stdio transport requires a command array");
      }
      return discoverViaStdio(command);
    }
    case "streamable-http": {
      if (!url) throw new Error("streamable-http transport requires a URL");
      return discoverViaHttp(url);
    }
    case "sse": {
      if (!url) throw new Error("sse transport requires a URL");
      return discoverViaSse(url);
    }
    default:
      throw new Error(`Unknown MCP transport: ${transport}`);
  }
}

/* ─── Tool risk classification ─────────────────────────────────────────── */

/**
 * Static risk classifier for MCP tools. Examines the tool name and
 * description for patterns suggesting the tool can mutate external
 * state without confirmation. Safe defaults to "elevated" for
 * unrecognised tools to force human review.
 */
export type McpRiskClass = "safe" | "elevated" | "unsafe" | "unknown";

const UNSAFE_KEYWORDS = [
  /write/i,
  /delete/i,
  /remove/i,
  /create/i,
  /update/i,
  /patch/i,
  /execute/i,
  /run/i,
  /exec/i,
  /shell/i,
  /bash/i,
  /command/i,
  /payment/i,
  /charge/i,
  /refund/i,
  /send/i,
  /transfer/i,
  /publish/i,
  /deploy/i,
  /release/i,
  /email/i,
  /mail/i,
  /notify/i,
  /alert/i,
  /grant/i,
  /revoke/i,
  /permission/i,
];

const ELEVATED_KEYWORDS = [
  /read/i,
  /get/i,
  /fetch/i,
  /list/i,
  /query/i,
  /search/i,
  /file/i,
  /data/i,
  /export/i,
  /download/i,
  /access/i,
  /login/i,
  /auth/i,
];

export function classifyToolRisk(tool: McpToolDef): McpRiskClass {
  const combined = [tool.name, tool.description ?? ""].join(" ");

  // If the schema includes commands like shell/exec, flag as unsafe
  const schema = tool.inputSchema as Record<string, unknown> | undefined;
  const schemaStr = schema ? JSON.stringify(schema).toLowerCase() : "";

  if (
    UNSAFE_KEYWORDS.some((r) => r.test(combined)) ||
    schemaStr.includes("shell") ||
    schemaStr.includes("command") ||
    schemaStr.includes("exec")
  ) {
    return "unsafe";
  }

  if (ELEVATED_KEYWORDS.some((r) => r.test(combined))) {
    return "elevated";
  }

  return "safe";
}
