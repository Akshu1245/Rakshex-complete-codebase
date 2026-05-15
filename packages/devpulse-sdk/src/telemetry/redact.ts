/**
 * DevPulse SDK — PII Redaction
 *
 * Strips personally identifiable information from prompts and responses
 * before they leave the customer's environment.
 */
import crypto from "crypto";
import { createHash } from "crypto";

// Regex patterns for common PII
const PII_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL_REDACTED]" },
  { name: "phone", regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: "[PHONE_REDACTED]" },
  { name: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN_REDACTED]" },
  { name: "credit_card", regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: "[CREDIT_CARD_REDACTED]" },
  { name: "ip_address", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[IP_REDACTED]" },
  { name: "api_key", regex: /\b(sk-[a-zA-Z0-9]{20,}|xai-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z_-]{35})\b/g, replacement: "[API_KEY_REDACTED]" },
  { name: "jwt", regex: /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, replacement: "[JWT_REDACTED]" },
  { name: "aws_key", regex: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, replacement: "[AWS_KEY_REDACTED]" },
  // Indian PII — DPDP 2023 compliance
  {
    name: "aadhaar",
    regex: /\b(?:\d{4}[\s-]?){2}\d{4}\b/g,
    replacement: "[AADHAAR_REDACTED]",
  },
  {
    name: "pan",
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: "[PAN_REDACTED]",
  },
  {
    name: "ifsc",
    regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    replacement: "[IFSC_REDACTED]",
  },
  {
    name: "passport_in",
    regex: /\b[A-Z][1-9]\d{6}\b/g,
    replacement: "[PASSPORT_REDACTED]",
  },
];

export interface RedactionResult {
  text: string;
  redactionCount: number;
  redactedTypes: string[];
}

export function redactPII(text: string): RedactionResult {
  let redacted = text;
  let count = 0;
  const types: string[] = [];

  for (const pattern of PII_PATTERNS) {
    const matches = redacted.match(pattern.regex);
    if (matches) {
      count += matches.length;
      types.push(pattern.name);
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
  }

  return { text: redacted, redactionCount: count, redactedTypes: types };
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 64);
}
