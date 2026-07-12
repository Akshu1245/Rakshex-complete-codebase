export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface AiAsset {
  id: string;
  kind: "agent" | "model_endpoint" | "mcp_server" | "tool" | "prompt" | "dataset";
  name: string;
  provider?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}

export interface McpServerConfig {
  name: string;
  transport: "stdio" | "streamable-http" | "sse";
  command?: string[];
  url?: string;
  env?: Record<string, string>;
  tools?: McpToolDef[];
}

export interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface PermissionFinding {
  code: string;
  severity: RiskLevel;
  message: string;
  evidence: string[];
  toolName?: string;
  serverName?: string;
}

export interface RiskScore {
  score: number; // 0-100
  level: RiskLevel;
  findings: PermissionFinding[];
}

export interface InventorySnapshot {
  assets: AiAsset[];
  servers: McpServerConfig[];
  tools: Array<McpToolDef & { serverName: string }>;
  scannedAt: string;
}
