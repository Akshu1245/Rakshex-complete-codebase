/**
 * Local-only collection analysis.
 *
 * The hosted Workers API has no collections endpoint, so Postman/OpenAPI
 * import is a local scan: extract endpoints, flag exposed secrets and
 * plaintext-HTTP usage. Nothing leaves the machine.
 */

export interface LocalCredentialFinding {
  ruleId: string;
  description: string;
  severity: string;
  path: string;
  matchPreview: string;
}

const SECRET_PATTERNS: Array<{ regex: RegExp; type: string }> = [
  { regex: /sk-[a-zA-Z0-9]{48}/g, type: "OpenAI API Key" },
  { regex: /sk-ant-[a-zA-Z0-9]{32,}/g, type: "Anthropic API Key" },
  { regex: /AIza[0-9A-Za-z_-]{35}/g, type: "Google AI API Key" },
  { regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/g, type: "Bearer Token" },
  { regex: /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi, type: "Hardcoded API Key" },
  { regex: /password\s*[:=]\s*["'][^"']{4,}["']/gi, type: "Hardcoded Password" },
];

function preview(match: string): string {
  return match.length <= 16
    ? match
    : `${match.substring(0, 8)}...${match.substring(match.length - 4)}`;
}

export function scanCollectionForCredentials(
  data: unknown,
  format: "postman" | "openapi",
): LocalCredentialFinding[] {
  const findings: LocalCredentialFinding[] = [];
  const seen = new Set<string>();
  const push = (f: LocalCredentialFinding) => {
    const key = `${f.ruleId}:${f.path}:${f.matchPreview}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };

  let text: string;
  try {
    text = JSON.stringify(data);
  } catch {
    return findings;
  }

  for (const { regex, type } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    const matches = text.match(regex) ?? [];
    for (const m of matches) {
      push({
        ruleId: "secret-in-collection",
        description: `Exposed ${type} found in ${format} collection`,
        severity: "Critical",
        path: "(collection body)",
        matchPreview: preview(m),
      });
    }
  }

  // Plaintext HTTP usage — check declared servers/URLs.
  const httpUrls = text.match(/"https?:\\?\/\\?\/[^"\\]+|https?:\/\/[^\s"\\,}]+/g) ?? [];
  for (const raw of httpUrls) {
    const url = raw.replace(/\\+/g, "").replace(/^"/, "");
    if (url.startsWith("http://") && !url.startsWith("http://localhost")) {
      push({
        ruleId: "plaintext-http",
        description: "Insecure HTTP endpoint — data transmitted in plaintext",
        severity: "High",
        path: url.slice(0, 80),
        matchPreview: url.slice(0, 60),
      });
    }
  }

  return findings;
}
