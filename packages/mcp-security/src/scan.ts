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

/**
 * Adversarial-intent checks — distinct from the capability-class checks
 * above. Those answer "what can this tool do if used as advertised?".
 * These answer "is this tool lying about what it does, or hiding something
 * in its own definition?" A tool can be capability-"safe" (a plain search
 * tool) and still be malicious via typosquatting, hidden instructions, or
 * a bait-and-switch description. Zero-width/invisible characters and
 * well-known-tool-name impersonation don't show up in a keyword scan of
 * visible text, so they need their own detectors.
 */
// Explicit \u escapes rather than literal invisible glyphs in source —
// zero-width space, zero-width non-joiner/joiner, word joiner, BOM,
// Mongolian vowel separator.
const ZERO_WIDTH_CHARS = /\u200B|\u200C|\u200D|\u2060|\uFEFF|\u180E/;
// A conservative homoglyph set — Cyrillic/Greek characters that render
// identically to Latin ones in most fonts, commonly used to impersonate
// a trusted tool name (e.g. "read_file" with a Cyrillic "е" in place of
// the Latin one). Range covers Cyrillic (U+0400–U+04FF) and Greek
// (U+0370–U+03FF).
const HOMOGLYPH_CHARS = /[\u0400-\u04FF\u0370-\u03FF]/;

const PROMPT_INJECTION_PATTERNS = [
  /<system>/i,
  /ignore (all )?(previous|prior|above) instructions/i,
  /disregard (all )?(previous|prior|above)/i,
  /you must (always|never)/i,
  /do not (tell|inform|notify) the user/i,
  /this is (a )?system (message|instruction)/i,
];

// Names of widely-used MCP/agent tools, used as the typosquatting
// reference set. Kept intentionally small and high-confidence rather than
// exhaustive — false positives on an edit-distance check erode trust in
// the scanner fast.
const WELL_KNOWN_TOOL_NAMES = [
  "read_file",
  "write_file",
  "list_directory",
  "list_dir",
  "delete_file",
  "execute_command",
  "run_command",
  "fetch",
  "http_request",
  "web_search",
  "browser_navigate",
  "send_email",
  "get_secret",
  "read_env",
  "search_web",
  "run_python",
  "shell",
  "bash",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/** Adversarial-intent scan — hidden characters, name impersonation, prompt-injection-shaped descriptions. */
export function scanToolForThreats(tool: McpToolDef, serverName?: string): PermissionFinding[] {
  const findings: PermissionFinding[] = [];
  const name = tool.name ?? "";
  const description = tool.description ?? "";
  const combined = `${name} ${description}`;

  if (ZERO_WIDTH_CHARS.test(combined)) {
    findings.push({
      code: "hidden_instruction",
      severity: "critical",
      message: `Tool ${name} definition contains zero-width/invisible Unicode characters`,
      evidence: [JSON.stringify(combined)],
      toolName: name,
      serverName,
    });
  }
  if (HOMOGLYPH_CHARS.test(name)) {
    findings.push({
      code: "hidden_instruction",
      severity: "high",
      message: `Tool ${name} name contains non-Latin characters that may be homoglyph impersonation`,
      evidence: [name],
      toolName: name,
      serverName,
    });
  }

  const lowerName = name.toLowerCase();
  for (const known of WELL_KNOWN_TOOL_NAMES) {
    if (lowerName === known) continue;
    const distance = levenshtein(lowerName, known);
    if (distance > 0 && distance <= 2 && Math.abs(lowerName.length - known.length) <= 2) {
      findings.push({
        code: "typosquatting",
        severity: "high",
        message: `Tool name "${name}" is suspiciously close to well-known tool "${known}" (edit distance ${distance})`,
        evidence: [name, known],
        toolName: name,
        serverName,
      });
      break;
    }
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(description)) {
      findings.push({
        code: "rug_pull",
        severity: "critical",
        message: `Tool ${name} description contains instruction-like language aimed at the calling model, not the user`,
        evidence: [description],
        toolName: name,
        serverName,
      });
      break;
    }
  }
  // Abnormally long descriptions are a common rug-pull vector — extra text
  // buried past what a human reviewer reads in the approval UI.
  if (description.length > 1200) {
    findings.push({
      code: "rug_pull",
      severity: "medium",
      message: `Tool ${name} has an unusually long description (${description.length} chars) — review in full before approving`,
      evidence: [`${description.length} characters`],
      toolName: name,
      serverName,
    });
  }

  return findings;
}

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
    findings.push(...scanTool(tool, server.name), ...scanToolForThreats(tool, server.name));
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
