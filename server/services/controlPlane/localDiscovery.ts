import { createHash } from "node:crypto";
import type { ControlPlaneProvider } from "./providerRegistry";

export interface LocalDiscoveryFinding {
  kind: "credential" | "sdk_usage" | "model_usage";
  provider?: ControlPlaneProvider;
  fingerprint: string;
  maskedValue?: string;
  sourcePath?: string;
  model?: string;
  severity: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}

const patterns: Array<{
  provider: ControlPlaneProvider;
  regex: RegExp;
  severity: LocalDiscoveryFinding["severity"];
}> = [
  { provider: "openai", regex: /sk-(?!ant-)[A-Za-z0-9_-]{20,}/g, severity: "high" },
  { provider: "anthropic", regex: /sk-ant-[A-Za-z0-9_-]{20,}/g, severity: "high" },
  {
    provider: "github_copilot",
    regex: /ghu_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}/g,
    severity: "high",
  },
  { provider: "azure_openai", regex: /azure[_-]openai|AZURE_OPENAI_API_KEY/gi, severity: "medium" },
  { provider: "bedrock", regex: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
  { provider: "vertex", regex: /GOOGLE_APPLICATION_CREDENTIALS|vertexai/gi, severity: "medium" },
];

const sdkPatterns: Array<{ provider: ControlPlaneProvider; regex: RegExp }> = [
  { provider: "openai", regex: /from\s+["']openai["']|require\(["']openai["']\)/g },
  { provider: "anthropic", regex: /from\s+["']@anthropic-ai\/sdk["']/g },
  { provider: "bedrock", regex: /@aws-sdk\/client-bedrock|boto3\.client\(["']bedrock["']/g },
  { provider: "vertex", regex: /@google-cloud\/vertexai|vertexai\.GenerativeModel/g },
];

const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
const mask = (value: string) =>
  value.length <= 8 ? "********" : `${value.slice(0, 4)}...${value.slice(-4)}`;

export function scanLocalText(content: string, sourcePath?: string): LocalDiscoveryFinding[] {
  const findings: LocalDiscoveryFinding[] = [];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern.regex)) {
      const value = match[0];
      findings.push({
        kind: "credential",
        provider: pattern.provider,
        fingerprint: fingerprint(value),
        maskedValue: mask(value),
        sourcePath,
        severity: pattern.severity,
        metadata: { localOnly: true },
      });
    }
  }
  for (const pattern of sdkPatterns) {
    if (pattern.regex.test(content)) {
      findings.push({
        kind: "sdk_usage",
        provider: pattern.provider,
        fingerprint: fingerprint(`${pattern.provider}:${sourcePath ?? "unknown"}`),
        sourcePath,
        severity: "low",
        metadata: { localOnly: true },
      });
      pattern.regex.lastIndex = 0;
    }
  }
  return findings;
}
