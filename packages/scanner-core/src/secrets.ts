/**
 * High-confidence secret pattern scanner for source trees.
 * Offline, deterministic, no network. Prefer precision over recall.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

export type SecretSeverity = "Critical" | "High";

export interface SecretFinding {
  ruleId: string;
  title: string;
  severity: SecretSeverity;
  confidence: "confirmed" | "high";
  file: string;
  line: number;
  /** Redacted match preview */
  preview: string;
  fingerprint: string;
}

interface SecretRule {
  id: string;
  title: string;
  severity: SecretSeverity;
  confidence: "confirmed" | "high";
  pattern: RegExp;
}

const SECRET_RULES: SecretRule[] = [
  {
    id: "secret.aws_access_key",
    title: "AWS access key ID",
    severity: "Critical",
    confidence: "confirmed",
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
  },
  {
    id: "secret.github_pat",
    title: "GitHub personal access token",
    severity: "Critical",
    confidence: "confirmed",
    pattern: /\b(ghp_[A-Za-z0-9_]{36,})\b/g,
  },
  {
    id: "secret.github_fine_grained",
    title: "GitHub fine-grained PAT",
    severity: "Critical",
    confidence: "high",
    pattern: /\b(github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    id: "secret.openai_api_key",
    title: "OpenAI API key",
    severity: "Critical",
    confidence: "confirmed",
    pattern: /\b(sk-[A-Za-z0-9]{20,})\b/g,
  },
  {
    id: "secret.slack_bot_token",
    title: "Slack bot token",
    severity: "High",
    confidence: "confirmed",
    pattern: /\b(xoxb-[0-9A-Za-z-]{10,})\b/g,
  },
  {
    id: "secret.private_key_header",
    title: "Private key block",
    severity: "Critical",
    confidence: "confirmed",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    id: "secret.stripe_live_key",
    title: "Stripe live secret key",
    severity: "Critical",
    confidence: "confirmed",
    pattern: /\b(sk_live_[0-9A-Za-z]{16,})\b/g,
  },
];

const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".env",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".md",
  ".txt",
  ".sh",
  ".bash",
  ".zsh",
  ".conf",
  ".cfg",
  ".ini",
  ".properties",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
]);

function redact(match: string): string {
  if (match.length <= 8) return "***";
  return `${match.slice(0, 4)}…${match.slice(-4)}`;
}

function fingerprint(ruleId: string, file: string, line: number, match: string): string {
  return createHash("sha256")
    .update(`${ruleId}|${file}|${line}|${match}`)
    .digest("hex")
    .slice(0, 16);
}

export function scanTextForSecrets(content: string, filePath = "<memory>"): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const rule of SECRET_RULES) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(line)) !== null) {
        const raw = m[1] ?? m[0]!;
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          confidence: rule.confidence,
          file: filePath,
          line: i + 1,
          preview: redact(raw),
          fingerprint: fingerprint(rule.id, filePath, i + 1, raw),
        });
      }
    }
  }
  return findings;
}

function shouldScanFile(name: string): boolean {
  if (name.startsWith(".env")) return true;
  const ext = extname(name).toLowerCase();
  if (TEXT_EXTS.has(ext)) return true;
  // extensionless env-like files
  return /^(id_rsa|id_ed25519|credentials)$/i.test(name);
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && st.size <= 1_000_000 && shouldScanFile(name)) out.push(p);
    }
  };
  const rootStat = statSync(root);
  if (rootStat.isFile()) return [root];
  walk(root);
  return out;
}

export function scanPathForSecrets(root: string): SecretFinding[] {
  const abs = root;
  const files = collectFiles(abs);
  const all: SecretFinding[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // skip binary-ish
    if (text.includes("\u0000")) continue;
    const rel = relative(abs, file) || file;
    for (const f of scanTextForSecrets(text, rel)) {
      if (seen.has(f.fingerprint)) continue;
      seen.add(f.fingerprint);
      all.push(f);
    }
  }
  return all;
}

export function listSecretRuleIds(): string[] {
  return SECRET_RULES.map((r) => r.id);
}
