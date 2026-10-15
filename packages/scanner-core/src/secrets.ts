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
 * What RaksHex actually knows about a match (legacy field, kept for API consumers).
 * - pattern_match: the provider format matched, but the value is synthetic or the evidence is weak.
 * - likely_secret: format matched AND the value has the statistical shape of a generated credential.
 * - verified_valid: a real, authorized validity check succeeded. NEVER set by this scanner.
 */
export type SecretState = "pattern_match" | "likely_secret" | "verified_valid";
export type SecretConfidence = "low" | "medium" | "high";
/** Only an authorized live check may move this off "not_verified"; no verifier exists, so it never does. */
export type VerificationStatus = "not_verified" | "verified_valid" | "verified_invalid";
/**
 * known_dummy: exact match (by SHA-256) of a published documentation dummy (e.g. AWS / Stripe docs examples).
 * synthetic_placeholder: the value itself is demonstrably synthetic (repeated chars, periodic filler, templates,
 *   sequences, or nothing random left once filler words are removed). A substring such as "example" alone is
 *   NEVER enough.
 * ambiguous: credential-shaped but randomness is weak; shown with reasons, never silently dropped.
 * plausible_credential: high-entropy, credential-shaped value. Stays suspicious regardless of substrings,
 *   file path or comments.
 */
export type SecretClassification =
  "known_dummy" | "synthetic_placeholder" | "ambiguous" | "plausible_credential";

export interface SecretFinding {
  ruleId: string;
  title: string;
  /** Effective severity used by the CI gate. */
  severity: SecretSeverity;
  /** Severity if this were a real exposed credential (rule property, not evidence). */
  potential_impact: SecretSeverity;
  /** How likely the value is a real credential (evidence, not impact). */
  detection_confidence: SecretConfidence;
  verification_status: VerificationStatus;
  classification: SecretClassification;
  /** Why (e.g. "synthetic:periodic", "entropy:4.61", "context:test-path", "word:example(no-exemption)"). */
  signals: string[];
  file: string;
  line: number;
  /** Redacted match preview */
  preview: string;
  /** sha256(ruleId|file|line|value) prefix: dedupe key. */
  fingerprint: string;
  /** sha256(ruleId|file|line): allowlist key that survives value rotation at the same place. */
  location_fingerprint: string;
  /** sha256(value): allowlist key for an exact value. Never the value itself. */
  value_sha256: string;
  /** Legacy aliases (same data as above). */
  impactIfReal: SecretSeverity;
  confidence: SecretConfidence;
  state: SecretState;
  verification: { ran: false; reason: string };
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
  {
    id: "secret.aws_access_key",
    title: "AWS access key ID",
    impactIfReal: "Critical",
    pattern: new RegExp("\\b(" + P("AK", "IA") + "[0-9A-Z]{16})\\b", "g"),
    prefix: 4,
  },
  {
    id: "secret.github_pat",
    title: "GitHub personal access token",
    impactIfReal: "Critical",
    pattern: new RegExp("\\b(" + P("gh", "p_") + "[A-Za-z0-9_]{36,})\\b", "g"),
    prefix: 4,
  },
  {
    id: "secret.github_oauth_or_app",
    title: "GitHub OAuth/app/user token",
    impactIfReal: "Critical",
    pattern: new RegExp("\\b(gh[osu]_[A-Za-z0-9_]{36,})\\b", "g"),
    prefix: 4,
  },
  {
    id: "secret.github_fine_grained",
    title: "GitHub fine-grained PAT",
    impactIfReal: "Critical",
    pattern: new RegExp("\\b(" + P("github", "_pat_") + "[A-Za-z0-9_]{20,})\\b", "g"),
    prefix: 11,
  },
  {
    id: "secret.openai_project_key",
    title: "OpenAI project/service-account/admin key",
    impactIfReal: "Critical",
    pattern: new RegExp(
      "(?<![A-Za-z0-9_-])(" + P("sk", "-") + "(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,})",
      "g",
    ),
    prefix: 8,
  },
  {
    id: "secret.openai_api_key",
    title: "OpenAI API key (legacy format)",
    impactIfReal: "Critical",
    pattern: new RegExp("\\b(" + P("sk", "-") + "[A-Za-z0-9]{20,})\\b", "g"),
    prefix: 3,
  },
  {
    id: "secret.anthropic_api_key",
    title: "Anthropic API key",
    impactIfReal: "Critical",
    pattern: new RegExp("(?<![A-Za-z0-9_-])(" + P("sk", "-ant-") + "[A-Za-z0-9_-]{20,})", "g"),
    prefix: 7,
  },
  {
    id: "secret.slack_bot_token",
    title: "Slack bot token",
    impactIfReal: "High",
    pattern: new RegExp("\\b(" + P("xo", "xb-") + "[0-9A-Za-z-]{10,})\\b", "g"),
    prefix: 5,
  },
  {
    id: "secret.slack_user_token",
    title: "Slack user token",
    impactIfReal: "High",
    pattern: new RegExp("\\b(" + P("xo", "xp-") + "[0-9A-Za-z-]{10,})\\b", "g"),
    prefix: 5,
  },
  {
    id: "secret.private_key_header",
    title: "Private key block",
    impactIfReal: "Critical",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    prefix: 0,
    structural: true,
  },
  {
    id: "secret.stripe_live_key",
    title: "Stripe live secret key",
    impactIfReal: "Critical",
    pattern: new RegExp("\\b(" + P("sk", "_live_") + "[0-9A-Za-z]{16,})\\b", "g"),
    prefix: 8,
  },
  {
    id: "secret.stripe_restricted_live_key",
    title: "Stripe restricted live key",
    impactIfReal: "High",
    pattern: new RegExp("\\b(" + P("rk", "_live_") + "[0-9A-Za-z]{16,})\\b", "g"),
    prefix: 8,
  },
  {
    id: "secret.stripe_test_key",
    title: "Stripe test-mode secret key",
    impactIfReal: "Low",
    pattern: new RegExp("\\b(" + P("sk", "_test_") + "[0-9A-Za-z]{16,})\\b", "g"),
    prefix: 8,
  },
];

/** SHA-256 of exact, published documentation dummies (no literal token is stored in this file). */
export const KNOWN_DUMMY_SHA256 = new Set<string>([
  "1a5d44a2dca19669d72edf4c4f1c27c4c1ca4b4408fbb17f6ce4ad452d78ddb3", // AWS docs example access key id
  "c6ea27c534f993d31f0aef882e3d200e7b87470c379ae79c8f9b19d3bd363dc9", // AWS docs example access key id (2nd)
  "2cafc0970149a84f3b9e62eaf169f36f59907a3b3e31f7b82e68c69cd27f7326", // Stripe docs test secret key
  "f2d6ca16515033e5dce14eba840b979d27b5cbae24bb3e5bf484339667f86397", // Stripe docs test secret key (older)
  "7e8de44ea9ecf6d53415c90f5b249a8591f7abafbf7d65a2c0d855afeca3ec09", // Stripe docs test secret key (older)
]);

const FILLER_WORDS =
  /(example|examples|fake|dummy|sample|placeholder|redacted|changeme|replace|insert|your|here|key|token|secret|test|invalid|notreal|xxx+)/gi;
const TEST_PATH =
  /(^|[\\/])(test|tests|__tests__|spec|fixtures?|examples?|mocks?|docs?)([\\/]|$)|\.(test|spec)\.[a-z]+$/i;
const VERIFICATION = {
  ran: false as const,
  reason:
    "no provider validity check implemented; RaksHex never sends customer values to providers",
};

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

export function sha256Hex(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** Removes ascending/descending runs (>= 5) like 12345 / abcde / EDCBA. */
function stripSequences(v: string): string {
  let out = "",
    i = 0;
  while (i < v.length) {
    let j = i + 1;
    const step = v.charCodeAt(i + 1) - v.charCodeAt(i);
    if (step === 1 || step === -1)
      while (j < v.length && v.charCodeAt(j) - v.charCodeAt(j - 1) === step) j++;
    if (j - i >= 5) {
      i = j;
      continue;
    }
    out += v[i];
    i++;
  }
  return out;
}

/** True if v is some unit of length <= 8 repeated at least 3 times (partial last unit allowed). */
function isPeriodic(v: string): boolean {
  if (v.length < 8) return false;
  for (let p = 1; p <= Math.min(8, Math.floor(v.length / 3)); p++) {
    let ok = true;
    for (let k = p; k < v.length; k++)
      if (v[k] !== v[k % p]) {
        ok = false;
        break;
      }
    if (ok) return true;
  }
  return false;
}

/**
 * Evidence that the VALUE ITSELF is synthetic. Returns [] for anything with real randomness left,
 * even if it contains words such as "example" or "test".
 */
export function syntheticSignals(body: string): string[] {
  const out: string[] = [];
  if (!body) return ["synthetic:empty"];
  const longestRun = Math.max(...(body.match(/(.)\1*/g) ?? [""]).map((r) => r.length));
  if (longestRun >= Math.max(6, body.length / 2)) out.push("synthetic:repeated-run");
  if (isPeriodic(body)) out.push("synthetic:periodic");
  if (/^[xX*#._-]+$/.test(body)) out.push("synthetic:template");
  // Strip filler words, repeated runs and sequences: what remains is the "random" part.
  const residual = stripSequences(body.replace(FILLER_WORDS, ""))
    .replace(/(.)\1{2,}/g, "")
    .replace(/[_-]/g, "");
  // Short formats (16-char AWS IDs) get a proportionally lower bar for "random content left".
  const minResidual = Math.min(8, Math.ceil(body.length * 0.3));
  if (residual.length < minResidual) out.push(`synthetic:no-random-residual(${residual.length})`);
  else if (isPeriodic(residual)) out.push("synthetic:periodic-residual");
  else if (residual.length >= 16 && new Set(residual).size / residual.length < 0.25)
    out.push("synthetic:low-variety");
  else if (residual.length >= 16 && shannonEntropy(residual) < 2.5)
    out.push("synthetic:low-entropy-residual");
  return out;
}

/** Back-compat name used by older tests/consumers. */
export const placeholderSignals = (body: string, _line = ""): string[] => syntheticSignals(body);

export interface Classification {
  state: SecretState;
  confidence: SecretConfidence;
  severity: SecretSeverity;
  classification: SecretClassification;
  signals: string[];
}

const DOWN: Record<SecretSeverity, SecretSeverity> = {
  Critical: "High",
  High: "Medium",
  Medium: "Low",
  Low: "Low",
  Info: "Info",
};
const LOWER: Record<SecretConfidence, SecretConfidence> = {
  high: "medium",
  medium: "low",
  low: "low",
};

/** Minimum base64 characters for a body that could hold a real private key (smallest EC keys are ~120). */
export const PEM_MIN_BODY = 64;

/**
 * Extract the key body that follows a BEGIN header: on the same line after the header (handles
 * escaped "\\n" in JSON/env strings) and on the following lines, up to an END marker.
 */
export function extractPemBody(
  raw: string,
  line: string,
  following: string[],
): { body: string; ended: boolean } {
  const tail = line.slice(line.indexOf(raw) + raw.length);
  const chunks = [tail.replace(/\\[nr]/g, "\n"), ...following];
  let body = "";
  for (const chunk of chunks) {
    for (const part of chunk.split("\n")) {
      if (/-----END [A-Z ]*PRIVATE KEY-----/.test(part)) {
        body += part.split("-----END")[0]!.replace(/[^A-Za-z0-9+/=]/g, "");
        return { body, ended: true };
      }
      const t = part
        .trim()
        .replace(/^["'`]|["'`,;]+$/g, "")
        .trim();
      if (t === "") continue;
      if (/^[A-Za-z-]+: /.test(t)) continue; // legacy PEM headers (Proc-Type, DEK-Info)
      if (!/^[A-Za-z0-9+/=]+$/.test(t)) return { body, ended: false };
      body += t;
    }
  }
  return { body, ended: false };
}

function classifyPemBlock(
  rule: Pick<SecretRule, "impactIfReal">,
  raw: string,
  line: string,
  following: string[],
  signals: string[],
): Classification {
  const { body, ended } = extractPemBody(raw, line, following);
  if (body.length < PEM_MIN_BODY) {
    // A header with no key material cannot leak a key. Reported transparently, never gating.
    return {
      state: "pattern_match",
      confidence: "low",
      severity: "Low",
      classification: "ambiguous",
      signals: [...signals, "structural-marker", `pem:header-without-key-body(${body.length}b64)`],
    };
  }
  // Long-body checks (the short-token residual ratios don't apply to 100s of base64 chars).
  const syn: string[] = [];
  const run = Math.max(...(body.match(/(.)\1*/g) ?? [""]).map((r) => r.length));
  if (run >= 16) syn.push("synthetic:repeated-run");
  if (isPeriodic(body.slice(0, 96))) syn.push("synthetic:periodic");
  if (new Set(body).size < 24) syn.push("synthetic:low-variety");
  if (shannonEntropy(body) < 4.5) syn.push("synthetic:low-entropy");
  if (syn.length > 0) {
    return {
      state: "pattern_match",
      confidence: "low",
      severity: "Info",
      classification: "synthetic_placeholder",
      signals: [...signals, "structural-marker", "pem:body-synthetic", ...syn],
    };
  }
  return {
    state: "pattern_match",
    confidence: ended ? "high" : "medium",
    severity: rule.impactIfReal,
    classification: "plausible_credential",
    signals: [
      ...signals,
      "structural-marker",
      `pem:key-body(${body.length}b64${ended ? ",end-marker" : ""})`,
    ],
  };
}

export function classifyMatch(
  rule: Pick<SecretRule, "impactIfReal" | "prefix" | "structural">,
  raw: string,
  line: string,
  filePath: string,
  following: string[] = [],
): Classification {
  const signals: string[] = [];
  const inTestPath = TEST_PATH.test(filePath);
  // Context is recorded for transparency only: a test path or a comment never exempts a finding.
  if (inTestPath) signals.push("context:test-path(no-exemption)");
  const comment = line.replace(raw, "");
  if (/\b(placeholder|example|fake|dummy|not a real|sample)\b/i.test(comment))
    signals.push("context:comment-claims-placeholder(no-exemption)");
  if (rule.structural) return classifyPemBlock(rule, raw, line, following, signals);
  if (KNOWN_DUMMY_SHA256.has(sha256Hex(raw))) {
    return {
      state: "pattern_match",
      confidence: "low",
      severity: "Info",
      classification: "known_dummy",
      signals: [...signals, "known-dummy:exact-hash"],
    };
  }
  const body = raw.slice(rule.prefix);
  const h = shannonEntropy(body);
  signals.push("entropy:" + h.toFixed(2));
  const syn = syntheticSignals(body);
  if (syn.length > 0)
    return {
      state: "pattern_match",
      confidence: "low",
      severity: "Info",
      classification: "synthetic_placeholder",
      signals: [...signals, ...syn],
    };
  const words = body.match(FILLER_WORDS);
  if (words) signals.push(`word:${words[0]!.toLowerCase()}(no-exemption)`);
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((r) => r.test(body)).length;
  // Short bodies (AWS key IDs: 16 chars) cannot reach the entropy of long tokens.
  // Upper-case alphanumeric formats (AWS key IDs) cannot have lower-case letters.
  const strong =
    h >= (body.length < 24 ? 3.0 : 3.5) &&
    body.length >= 16 &&
    (classes >= 2 || /^[A-Z0-9]+$/.test(body));
  if (!strong) {
    return {
      state: "pattern_match",
      confidence: "low",
      severity: DOWN[rule.impactIfReal],
      classification: "ambiguous",
      signals: [...signals, "ambiguous:weak-randomness"],
    };
  }
  let confidence: SecretConfidence = "high";
  if (inTestPath) confidence = LOWER[confidence];
  return {
    state: "likely_secret",
    confidence,
    severity: rule.impactIfReal,
    classification: "plausible_credential",
    signals,
  };
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

export function locationFingerprint(ruleId: string, file: string, line: number): string {
  return sha256Hex(`${ruleId}|${file.replace(/\\/g, "/")}|${line}`).slice(0, 32);
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
        const c = classifyMatch(
          rule,
          raw,
          line,
          filePath,
          rule.structural ? lines.slice(i + 1, i + 120) : [],
        );
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: c.severity,
          potential_impact: rule.impactIfReal,
          detection_confidence: c.confidence,
          verification_status: "not_verified",
          classification: c.classification,
          signals: c.signals,
          file: filePath,
          line: i + 1,
          preview: redact(raw),
          fingerprint: fingerprint(rule.id, filePath, i + 1, raw),
          location_fingerprint: locationFingerprint(rule.id, filePath, i + 1),
          value_sha256: sha256Hex(raw),
          impactIfReal: rule.impactIfReal,
          confidence: c.confidence,
          state: c.state,
          verification: VERIFICATION,
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
