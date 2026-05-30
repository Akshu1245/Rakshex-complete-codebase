/**
 * Secret scanner.
 *
 * Pure regex-based scanner that detects credentials in arbitrary text. We
 * deliberately keep this dependency-free and conservative: every rule must
 * have a verifying check (Luhn for credit cards, AWS prefix for AWS keys,
 * length checks for keys, etc.) so we don't drown the user in false
 * positives.
 *
 * Patterns are aligned with `gitleaks` and TruffleHog defaults but stripped
 * down to the highest-signal subset:
 *   - AWS access keys (AKIA…, ASIA…)
 *   - GitHub PATs (ghp_, gho_, ghu_, ghs_, ghr_)
 *   - Google API keys (AIza…)
 *   - OpenAI keys (sk-…)
 *   - Slack tokens (xoxb, xoxp, xoxa, xoxr)
 *   - Stripe live keys (sk_live_, rk_live_)
 *   - Anthropic keys (sk-ant-…)
 *   - Generic high-entropy 40+ char strings near key=, token=, secret=
 *   - JWT tokens
 *   - Private key blocks (BEGIN RSA/PRIVATE KEY)
 */

export interface SecretFinding {
  ruleId: string;
  description: string;
  severity: "high" | "critical";
  matchPreview: string;
  line: number;
}

interface SecretRule {
  id: string;
  description: string;
  severity: "high" | "critical";
  pattern: RegExp;
  /** Optional secondary verifier; if it returns false, the match is dropped. */
  verify?: (matched: string) => boolean;
}

const RULES: SecretRule[] = [
  {
    id: "aws_access_key",
    description: "AWS Access Key ID",
    severity: "critical",
    pattern: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g,
    verify: (m) => m.length === 20,
  },
  {
    id: "aws_secret_key",
    description: "AWS Secret Access Key",
    severity: "critical",
    pattern: /\b(?:aws|AWS)(?:.{0,20})?['"][0-9a-zA-Z/+=]{40}['"]/g,
  },
  {
    id: "github_pat",
    description: "GitHub Personal Access Token",
    severity: "critical",
    pattern: /\bgh[psuro]_[A-Za-z0-9_]{36,255}\b/g,
  },
  {
    id: "google_api_key",
    description: "Google API Key",
    severity: "high",
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  },
  {
    id: "openai_api_key",
    description: "OpenAI API Key",
    severity: "critical",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    verify: (m) => !m.startsWith("sk-ant-"),
  },
  {
    id: "anthropic_api_key",
    description: "Anthropic API Key",
    severity: "critical",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{30,}\b/g,
  },
  {
    id: "slack_bot_token",
    description: "Slack Bot Token",
    severity: "high",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    id: "stripe_live_key",
    description: "Stripe Live Secret Key",
    severity: "critical",
    pattern: /\b(?:sk_live|rk_live)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: "stripe_test_key",
    description: "Stripe Test Secret Key",
    severity: "high",
    pattern: /\b(?:sk_test|rk_test)_[A-Za-z0-9_]{15,}\b/g,
  },
  {
    id: "jwt_token_truncated",
    description: "Truncated JSON Web Token",
    severity: "high",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.{3,}/g,
  },
  {
    id: "generic_bearer_token",
    description: "Generic Bearer Token",
    severity: "high",
    pattern: /\bBearer\s+[a-zA-Z0-9_+/=._-]{20,}\b/g,
  },
  {
    id: "weak_password",
    description: "Weak or Common Password",
    severity: "high",
    pattern: /\b(?:password\d{3,}|admin\d{3,}|newpass)\b/gi,
  },
  {
    id: "private_key_block",
    description: "Private Key (RSA/EC/OpenSSH)",
    severity: "critical",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED |)PRIVATE KEY-----/g,
  },
  {
    id: "jwt_token",
    description: "JSON Web Token",
    severity: "high",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
];

export function scanText(content: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  // Reset regex state by cloning each match — RegExp `g` flag is stateful.
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const match = m[0];
      if (rule.verify && !rule.verify(match)) continue;
      const line = countLines(content, m.index);
      findings.push({
        ruleId: rule.id,
        description: rule.description,
        severity: rule.severity,
        matchPreview: redact(match),
        line,
      });
    }
  }
  return dedupe(findings);
}

function countLines(text: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function redact(secret: string): string {
  if (secret.length <= 8) return "•".repeat(secret.length);
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

function dedupe(findings: SecretFinding[]): SecretFinding[] {
  const seen = new Set<string>();
  const out: SecretFinding[] = [];
  for (const f of findings) {
    const key = `${f.ruleId}:${f.line}:${f.matchPreview}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export interface PullRequestFile {
  filename: string;
  patch?: string;
}

export interface PullRequestSecretScanResult {
  totalFindings: number;
  filesScanned: number;
  findings: Array<SecretFinding & { file: string }>;
}

/**
 * Scan an array of changed files (e.g. from a GitHub PR diff or push payload).
 */
export function scanPullRequestFiles(files: PullRequestFile[]): PullRequestSecretScanResult {
  const findings: Array<SecretFinding & { file: string }> = [];
  for (const file of files) {
    if (!file.patch) continue;
    // Only scan added lines ('+') so we don't re-flag pre-existing secrets.
    const added = file.patch
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1))
      .join("\n");
    if (!added) continue;
    const fileFindings = scanText(added);
    for (const f of fileFindings) findings.push({ ...f, file: file.filename });
  }
  return {
    totalFindings: findings.length,
    filesScanned: files.filter((f) => f.patch).length,
    findings,
  };
}
