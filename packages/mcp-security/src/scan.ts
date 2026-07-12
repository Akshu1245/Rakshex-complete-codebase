import type {
  AiAsset,
  InventorySnapshot,
  McpServerConfig,
  McpToolDef,
  PermissionFinding,
  RiskLevel,
  RiskScore,
} from "./types.js";

const SHELL_TOOLS = /^(shell|bash|exec|run_command|terminal|powershell|cmd)$/i;
const FS_TOOLS = /^(read_file|write_file|list_dir|delete_file|fs_|filesystem)/i;
const NET_TOOLS = /^(http|fetch|request|browse|web_|curl|wget)/i;
const SECRET_TOOLS = /^(get_secret|read_env|vault|credential|api_key)/i;
const INJECTION_HINTS = /eval|exec|untrusted|raw_prompt|user_content/i;

export function scanMcpServer(server: McpServerConfig): PermissionFinding[] {
  const findings: PermissionFinding[] = [];
  const tools = server.tools ?? [];

  if (server.transport === "stdio" && server.command?.length) {
    const joined = server.command.join(" ");
    if (/[;&|`$]/.test(joined) || /\.\./.test(joined)) {
      findings.push({
        code: "stdio_command_metachar",
        severity: "critical",
        message: "stdio command contains shell metacharacters or path traversal",
        evidence: [joined],
        serverName: server.name,
      });
    }
  }

  if (server.transport !== "stdio" && server.url) {
    try {
      const u = new URL(server.url);
      if (u.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(u.hostname)) {
        findings.push({
          code: "insecure_mcp_url",
          severity: "high",
          message: "MCP server URL is not HTTPS",
          evidence: [server.url],
          serverName: server.name,
        });
      }
    } catch {
      findings.push({
        code: "invalid_mcp_url",
        severity: "medium",
        message: "MCP server URL is invalid",
        evidence: [server.url],
        serverName: server.name,
      });
    }
  }

  if (server.env) {
    for (const [k, v] of Object.entries(server.env)) {
      if (/key|secret|token|password/i.test(k) && v && v.length > 0) {
        findings.push({
          code: "secret_in_env",
          severity: "high",
          message: `Environment variable ${k} may expose secrets to MCP process`,
          evidence: [`${k}=[present]`],
          serverName: server.name,
        });
      }
    }
  }

  // Untrusted third-party heuristic: remote URL without known org
  if (server.url && !/localhost|127\.0\.0\.1|internal/i.test(server.url)) {
    findings.push({
      code: "untrusted_server_warning",
      severity: "medium",
      message: "Remote MCP server — verify trust before allowing tools",
      evidence: [server.url],
      serverName: server.name,
    });
  }

  for (const tool of tools) {
    findings.push(...scanTool(tool, server.name));
  }

  return findings;
}

export function scanTool(tool: McpToolDef, serverName?: string): PermissionFinding[] {
  const findings: PermissionFinding[] = [];
  const name = tool.name;
  const desc = `${tool.description ?? ""} ${JSON.stringify(tool.inputSchema ?? {})}`;

  if (SHELL_TOOLS.test(name) || /shell|execute/i.test(desc)) {
    findings.push({
      code: "shell_execution",
      severity: "critical",
      message: `Tool ${name} can execute shell commands`,
      evidence: [name, tool.description ?? ""],
      toolName: name,
      serverName,
    });
  }
  if (FS_TOOLS.test(name) || /filesystem|path/i.test(desc)) {
    findings.push({
      code: "filesystem_access",
      severity: "high",
      message: `Tool ${name} accesses the filesystem`,
      evidence: [name],
      toolName: name,
      serverName,
    });
  }
  if (NET_TOOLS.test(name) || /url|endpoint|http/i.test(desc)) {
    findings.push({
      code: "network_access",
      severity: "medium",
      message: `Tool ${name} has network access`,
      evidence: [name],
      toolName: name,
      serverName,
    });
  }
  if (SECRET_TOOLS.test(name) || /secret|credential|api.?key/i.test(desc)) {
    findings.push({
      code: "secret_access",
      severity: "critical",
      message: `Tool ${name} may access secrets`,
      evidence: [name],
      toolName: name,
      serverName,
    });
  }
  if (INJECTION_HINTS.test(desc)) {
    findings.push({
      code: "prompt_injection_risk",
      severity: "high",
      message: `Tool ${name} may pass untrusted content into prompts`,
      evidence: [tool.description ?? ""],
      toolName: name,
      serverName,
    });
  }

  return findings;
}

const LEVEL_SCORE: Record<RiskLevel, number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 80,
};

export function scoreFindings(findings: PermissionFinding[]): RiskScore {
  if (findings.length === 0) {
    return { score: 0, level: "low", findings: [] };
  }
  const score = Math.min(
    100,
    findings.reduce((acc, f) => acc + LEVEL_SCORE[f.severity], 0),
  );
  const level: RiskLevel =
    score >= 80 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low";
  return { score, level, findings };
}

export function buildInventory(
  servers: McpServerConfig[],
  extraAssets: AiAsset[] = [],
): InventorySnapshot {
  const tools = servers.flatMap((s) => (s.tools ?? []).map((t) => ({ ...t, serverName: s.name })));
  const assets: AiAsset[] = [
    ...extraAssets,
    ...servers.map((s) => ({
      id: `mcp:${s.name}`,
      kind: "mcp_server" as const,
      name: s.name,
      metadata: { transport: s.transport, url: s.url },
    })),
    ...tools.map((t) => ({
      id: `tool:${t.serverName}:${t.name}`,
      kind: "tool" as const,
      name: t.name,
      metadata: { server: t.serverName },
    })),
  ];
  return {
    assets,
    servers,
    tools,
    scannedAt: new Date().toISOString(),
  };
}

/** Runtime block check against tool allowlist */
export function isToolAllowed(
  toolName: string,
  allowlist: string[] | null,
  denylist: string[] = [],
): boolean {
  const n = toolName.toLowerCase();
  if (denylist.some((d) => d.toLowerCase() === n)) return false;
  if (allowlist == null) return true;
  return allowlist.some((a) => a.toLowerCase() === n);
}
