/**
 * Secret pattern scanner for source trees. Offline, deterministic, no network.
 * Findings carry a STATE (pattern_match / likely_secret; verified_valid is never set here),
 * a CONFIDENCE (low/medium/high) and a SEVERITY that are computed separately.
 * A regex match is never reported as "confirmed".
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

/** Impact if the value were a real, exposed credential. Separate from confidence. */
export type SecretSeverity = "Critical" | "High" | "Medium" | "Low" | "Info";

/**
 * What RaksHex actually knows about a match.
 * - pattern_match: the provider format matched; nothing else supports it (or it looks like a placeholder).
 * - likely_secret: format matched AND the value has the statistical shape of a generated credential.
 * - verified_valid: a real validity check against the provider succeeded. This scanner NEVER sets it:
 *   no verifier is implemented, and RaksHex does not call providers with customer values.
 */
export type SecretState = "pattern_match" | "likely_secret" | "verified_valid";
export type SecretConfidence = "low" | "medium" | "high";

export interface SecretFinding {
  ruleId: string;
  title: string;
  /** Effective severity used for --fail-on: impactIfReal, downgraded for placeholders / weak evidence. */
  severity: SecretSeverity;
  /** Severity if this were a real exposed credential (rule property, not evidence). */
  impactIfReal: SecretSeverity;
  state: SecretState;
  /** Confidence that the value is a real credential. Never "confirmed" from a regex. */
  confidence: SecretConfidence;
  /** Why the state/confidence was chosen (e.g. "placeholder:repeated-run", "entropy:4.6"). */
  signals: string[];
  verification: { ran: false; reason: string };
  file: string;
  line: number;
  /** Redacted match preview */
  preview: string;
  fingerprint: string;
}

interface SecretRule {
  id: string;
  title: string;
  impactIfReal: SecretSeverity;
  pattern: RegExp;
  /** Length of the fixed provider prefix (excluded from entropy). */
  prefix: number;
  /** Structural markers (private key headers) have no random body to measure. */
  structural?: boolean;
}

// Patterns are assembled from parts so this file never contains a literal token prefix
// that secret-scanning push protection would treat as a credential.
const P = (...parts: string[]) => parts.join("");

const SECRET_RULES: SecretRule[] = [
  { id: "secret.aws_access_key", title: "AWS access key ID", impactIfReal: "Critical", pattern: new RegExp("\\b(" + P("AK", "IA") + "[0-9A-Z]{16})\\b", "g"), prefix: 4 },
  { id: "secret.github_pat", title: "GitHub personal access token", impactIfReal: "Critical", pattern: new RegExp("\\b(" + P("gh", "p_") + "[A-Za-z0-9_]{36,})\\b", "g"), prefix: 4 },
  { id: "secret.github_oauth_or_app", title: "GitHub OAuth/app/user token", impactIfReal: "Critical", pattern: new RegExp("\\b(gh[osu]_[A-Za-z0-9_]{36,})\\b", "g"), prefix: 4 },
  { id: "secret.github_fine_grained", title: "GitHub fine-grained PAT", impactIfReal: "Critical", pattern: new RegExp("\\b(" + P("github", "_pat_") + "[A-Za-z0-9_]{20,})\\b", "g"), prefix: 11 },
  { id: "secret.openai_project_key", title: "OpenAI project/service-account/admin key", impactIfReal: "Critical", pattern: new RegExp("(?<![A-Za-z0-9_-])(" + P("sk", "-") + "(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,})", "g"), prefix: 8 },
  { id: "secret.openai_api_key", title: "OpenAI API key (legacy format)", impactIfReal: "Critical", pattern: new RegExp("\\b(" + P("sk", "-") + "[A-Za-z0-9]{20,})\\b", "g"), prefix: 3 },
  { id: "secret.anthropic_api_key", title: "Anthropic API key", impactIfReal: "Critical", pattern: new RegExp("(?<![A-Za-z0-9_-])(" + P("sk", "-ant-") + "[A-Za-z0-9_-]{20,})", "g"), prefix: 7 },
  { id: "secret.slack_bot_token", title: "Slack bot token", impactIfReal: "High", pattern: new RegExp("\\b(" + P("xo", "xb-") + "[0-9A-Za-z-]{10,})\\b", "g"), prefix: 5 },
  { id: "secret.slack_user_token", title: "Slack user token", impactIfReal: "High", pattern: new RegExp("\\b(" + P("xo", "xp-") + "[0-9A-Za-z-]{10,})\\b", "g"), prefix: 5 },
  { id: "secret.private_key_header", title: "Private key block", impactIfReal: "Critical", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, prefix: 0, structural: true },
  { id: "secret.stripe_live_key", title: "Stripe live secret key", impactIfReal: "Critical", pattern: new RegExp("\\b(" + P("sk", "_live_") + "[0-9A-Za-z]{16,})\\b", "g"), prefix: 8 },
  { id: "secret.stripe_restricted_live_key", title: "Stripe restricted live key", impactIfReal: "High", pattern: new RegExp("\\b(" + P("rk", "_live_") + "[0-9A-Za-z]{16,})\\b", "g"), prefix: 8 },
  { id: "secret.stripe_test_key", title: "Stripe test-mode secret key", impactIfReal: "Low", pattern: new RegExp("\\b(" + P("sk", "_test_") + "[0-9A-Za-z]{16,})\\b", "g"), prefix: 8 },
];

const PLACEHOLDER_WORDS = /(fake|example|dummy|placeholder|sample|redacted|changeme|replace|your[_-]?(?:key|token)|xxxx|test(?:key|token)|not[_-]?real|invalid)/i;
const SEQUENCES = ["0123456789", "1234567890", "abcdefghij", "ABCDEFGHIJ", "qwertyuiop"];
const TEST_PATH = /(^|[\\/])(test|tests|__tests__|spec|fixtures?|examples?|mocks?|docs?)([\\/]|$)|\.(test|spec)\.[a-z]+$/i;
const VERIFICATION = { ran: false as const, reason: "no provider validity check implemented; RaksHex never sends customer values to providers" };

export function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Returns placeholder reasons for a token body (prefix removed) and its line. */
export function placeholderSignals(body: string, line: string): string[] {
  const out: string[] = [];
  if (PLACEHOLDER_WORDS.test(body)) out.push("placeholder:word");
  if (/(.)\1{5,}/.test(body)) out.push("placeholder:repeated-run");
  if (SEQUENCES.some((seq) => body.includes(seq))) out.push("placeholder:sequence");
  const uniq = new Set(body).size;
  if (body.length >= 16 && uniq / body.length < 0.25) out.push("placeholder:low-variety");
  if (/\b(placeholder|example|fake|dummy|not a real|sample)\b/i.test(line.replace(body, ""))) out.push("placeholder:line-comment");
  return out;
}

export interface Classification {
  state: SecretState;
  confidence: SecretConfidence;
  severity: SecretSeverity;
  signals: string[];
}

const DOWN: Record<SecretSeverity, SecretSeverity> = { Critical: "High", High: "Medium", Medium: "Low", Low: "Low", Info: "Info" };

export function classifyMatch(rule: Pick<SecretRule, "impactIfReal" | "prefix" | "structural">, raw: string, line: string, filePath: string): Classification {
  const signals: string[] = [];
  const inTestPath = TEST_PATH.test(filePath);
  if (inTestPath) signals.push("context:test-or-fixture-path");
  if (rule.structural) {
    // A key header alone says nothing about the key material; treat as unverified pattern.
    return { state: "pattern_match", confidence: inTestPath ? "low" : "medium", severity: inTestPath ? DOWN[rule.impactIfReal] : rule.impactIfReal, signals: [...signals, "structural-marker"] };
  }
  const body = raw.slice(rule.prefix);
  const ph = placeholderSignals(body, line);
  const h = shannonEntropy(body);
  signals.push("entropy:" + h.toFixed(2));
  if (ph.length > 0) return { state: "pattern_match", confidence: "low", severity: "Info", signals: [...signals, ...ph] };
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((r) => r.test(body)).length;
  // Short bodies (AWS key IDs: 16 chars) cannot reach the entropy of long tokens.
  const strong = h >= (body.length < 24 ? 3.0 : 3.5) && body.length >= 16 && classes >= 2;
  if (!strong) return { state: "pattern_match", confidence: "low", severity: DOWN[DOWN[rule.impactIfReal]], signals: [...signals, "weak-randomness"] };
  if (inTestPath) return { state: "likely_secret", confidence: "medium", severity: DOWN[rule.impactIfReal], signals };
  return { state: "likely_secret", confidence: "high", severity: rule.impactIfReal, signals };
}

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
        const c = classifyMatch(rule, raw, line, filePath);
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: c.severity,
          impactIfReal: rule.impactIfReal,
          state: c.state,
          confidence: c.confidence,
          signals: c.signals,
          verification: VERIFICATION,
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
