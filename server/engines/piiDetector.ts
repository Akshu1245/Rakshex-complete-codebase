/**
 * PII Detection Engine for API response scanning.
 *
 * Detects personally identifiable information in text:
 *   - Email addresses
 *   - Phone numbers (international + Indian)
 *   - Credit card numbers
 *   - SSNs (US)
 *   - Indian Aadhaar (12-digit)
 *   - PAN card (AAAAA9999A)
 *   - UPI IDs (xxx@xxx)
 *   - API keys / secrets
 *
 * Configuration: per-PII-type enable/disable via PiiDetectorConfig.
 * Returns redacted text with PII replaced by type markers.
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type PiiType =
  | "email"
  | "phone"
  | "credit_card"
  | "ssn"
  | "aadhaar"
  | "pan_card"
  | "gstin"
  | "ifsc"
  | "upi_id"
  | "api_key"
  | "jwt_token"
  | "private_key";

export interface PiiDetectorConfig {
  enabledTypes: PiiType[];
  /** Custom patterns to also scan for (regex strings). */
  customPatterns?: string[];
}

export interface PiiMatch {
  type: PiiType;
  value: string;
  offset: number;
}

export interface PiiAssessment {
  hasPII: boolean;
  types: PiiType[];
  redactedText: string;
  count: number;
  matches: PiiMatch[];
}

// ─────────────────────────────────────────────────────────────────────────
// Pattern definitions
// ─────────────────────────────────────────────────────────────────────────

const PII_PATTERNS: Record<PiiType, RegExp> = {
  email: /\b[a-z0-9._%+\-—]+@[a-z0-9.\-—]+\.[a-z]{2,}\b/gi,

  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,

  credit_card: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,

  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,

  aadhaar: /\b[2-9]{1}[0-9]{3}[ ]?[0-9]{4}[ ]?[0-9]{4}\b/g,

  pan_card: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,

  gstin: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/gi,

  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi,

  upi_id: /\b[a-z0-9._\-]{2,}@[a-z]{2,}(?!\.[a-z])\b/gi,

  api_key:
    /(?:sk-|ak-|pk-|dp_|rk-|rk_live_|sk_live_|ghp_|gho_|ghu_|ghs_|ghr_|xai-|hf_)[a-zA-Z0-9_-]{20,}/g,

  jwt_token: /\beyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b/g,

  private_key:
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[a-zA-Z0-9+/\n\r=.\s]+-----END (?:RSA |EC )?PRIVATE KEY-----/g,
};

// Additional broader patterns for API key detection (not brand-specific)
const BROAD_KEY_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*['"]?([a-zA-Z0-9_\-+]{16,})['"]?/gi,
  /(?:Authorization|Bearer)\s+([a-zA-Z0-9_\-\.]{20,})/gi,
];

const REDACTION_MARKERS: Record<PiiType, string> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  credit_card: "[CC_NUMBER]",
  ssn: "[SSN]",
  aadhaar: "[AADHAAR]",
  pan_card: "[PAN]",
  gstin: "[GSTIN]",
  ifsc: "[IFSC]",
  upi_id: "[UPI_ID]",
  api_key: "[API_KEY]",
  jwt_token: "[JWT]",
  private_key: "[PRIVATE_KEY]",
};

// ─────────────────────────────────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────────────────────────────────

export function detectPII(
  text: string,
  config: PiiDetectorConfig = { enabledTypes: Object.keys(PII_PATTERNS) as PiiType[] },
): PiiAssessment {
  const matches: PiiMatch[] = [];
  const seenTypes = new Set<PiiType>();
  const enabled = new Set(config.enabledTypes);

  let redacted = text;

  // Collect all matches from enabled patterns
  for (const [type, regex] of Object.entries(PII_PATTERNS)) {
    const piiType = type as PiiType;
    if (!enabled.has(piiType)) continue;

    // Reset regex state
    regex.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const value = m[0].trim();
      // Basic validation filters
      if (!isValidPii(piiType, value)) continue;

      matches.push({ type: piiType, value, offset: m.index });
      seenTypes.add(piiType);
    }
  }

  // Broad patterns (additional api_key variants)
  if (enabled.has("api_key")) {
    for (const pattern of BROAD_KEY_PATTERNS) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(text)) !== null) {
        const value = m[1]?.trim() || m[0]?.trim();
        if (value && value.length >= 16 && !isCommonFalsePositive(value)) {
          matches.push({ type: "api_key", value, offset: m.index });
          seenTypes.add("api_key");
        }
      }
    }
  }

  // Custom patterns
  if (config.customPatterns) {
    for (const pattern of config.customPatterns) {
      try {
        const regex = new RegExp(pattern, "gi");
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          const value = m[0].trim();
          if (value.length > 3) {
            matches.push({
              type: "api_key",
              value,
              offset: m.index,
            });
            seenTypes.add("api_key");
          }
        }
      } catch {
        // Invalid regex — skip
      }
    }
  }

  // Sort matches by offset (descending) for safe replacement
  const sorted = [...matches].sort((a, b) => b.offset - a.offset);

  // Redact
  for (const match of sorted) {
    const marker = REDACTION_MARKERS[match.type];
    redacted =
      redacted.slice(0, match.offset) + marker + redacted.slice(match.offset + match.value.length);
  }

  return {
    hasPII: matches.length > 0,
    types: [...seenTypes],
    redactedText: redacted,
    count: matches.length,
    matches: matches.sort((a, b) => a.offset - b.offset),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────

function isValidPii(type: PiiType, value: string): boolean {
  switch (type) {
    case "email":
      return value.includes("@") && value.includes(".") && value.length <= 320;

    case "phone":
      // Must have at least 7 digits
      return (value.match(/\d/g) ?? []).length >= 7;

    case "credit_card":
      return isValidCreditCard(value);

    case "ssn":
      // Exclude obvious false positives like 000-00-0000
      return !/^0{3}-?0{2}-?0{4}$/.test(value.replace(/[-]/g, ""));

    case "aadhaar":
      return isValidAadhaar(value);

    case "pan_card":
      // PAN: 5 uppercase letters + 4 digits + 1 uppercase letter
      return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);

    case "gstin":
      // GSTIN length is exactly 15 characters
      return value.length === 15;

    case "ifsc":
      // IFSC length is exactly 11 characters
      return value.length === 11;

    case "upi_id":
      return value.includes("@");

    case "api_key":
      return value.length >= 16 && !isCommonFalsePositive(value);

    case "jwt_token":
      return value.length > 30 && value.split(".").length === 3;

    case "private_key":
      return value.includes("PRIVATE KEY-----");
  }
  return true;
}

function isValidCreditCard(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  // Luhn check
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function isValidAadhaar(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  if (/^[01]/.test(digits)) return false; // First digit must be 2-9
  // Verhoeff checkwould go here for brevity
  return true;
}

function isCommonFalsePositive(value: string): boolean {
  // Skip UUIDs, git hashes, timestamps, known false positives
  return (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-/.test(value) ||
    /^\d{4}-\d{2}-\d{2}/.test(value) ||
    /^[0-9a-fA-F]{40,}$/.test(value) ||
    /^npm_[a-zA-Z0-9]{36}$/.test(value) ||
    /^org_[a-zA-Z0-9]{36}$/.test(value)
  );
}
