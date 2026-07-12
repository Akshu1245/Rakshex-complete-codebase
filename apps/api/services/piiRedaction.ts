/**
 * PII redaction service with India-first patterns.
 *
 * Covers global patterns (email, credit card, SSN, phone) PLUS
 * India-specific identifiers: Aadhaar, PAN, IFSC, GSTIN, Indian
 * passport, voter ID, Indian phone numbers.
 */

export interface PiiMatch {
  type: string;
  value: string;
  preview: string;
  start: number;
  end: number;
}

interface PiiRule {
  type: string;
  pattern: RegExp;
  severity: "high" | "critical";
  category: string;
  verify?: (match: string) => boolean;
}

const INDIA_RULES: PiiRule[] = [
  {
    type: "Aadhaar",
    pattern: /\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g,
    severity: "critical",
    category: "India/Identity",
    verify: (m: string) => {
      const digits = m.replace(/\s/g, "");
      if (digits.length !== 12) return false;
      const d = digits.split("").map(Number);
      const check = d[11];
      let sum = 0;
      const mult = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];
      for (let i = 0; i < 11; i++) {
        let v = d[i] * mult[i];
        if (v > 9) v -= 9;
        sum += v;
      }
      const computed = (10 - (sum % 10)) % 10;
      return computed === check;
    },
  },
  {
    type: "PAN",
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
    severity: "critical",
    category: "India/Finance",
  },
  {
    type: "IFSC",
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    severity: "high",
    category: "India/Banking",
  },
  {
    type: "GSTIN",
    pattern: /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g,
    severity: "high",
    category: "India/Tax",
  },
  {
    type: "IndianPassport",
    pattern: /\b[A-Z]{1}[0-9]{7}\b/g,
    severity: "critical",
    category: "India/Identity",
  },
  {
    type: "VoterID",
    pattern: /\b[A-Z]{3}[0-9]{7}\b/g,
    severity: "high",
    category: "India/Identity",
  },
  {
    type: "IndianPhone",
    pattern: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g,
    severity: "high",
    category: "India/Contact",
  },
  {
    type: "UPI_ID",
    pattern: /\b[\w.-]+@[a-z]{3,}\b/g,
    severity: "high",
    category: "India/Payments",
  },
];

const GLOBAL_RULES: PiiRule[] = [
  {
    type: "Email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    severity: "high",
    category: "Global/Contact",
  },
  {
    type: "CreditCard",
    pattern:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: "critical",
    category: "Global/Finance",
    verify: (m: string) => {
      const digits = m.replace(/\D/g, "");
      let sum = 0;
      let alt = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10);
        if (alt) {
          n *= 2;
          if (n > 9) n -= 9;
        }
        sum += n;
        alt = !alt;
      }
      return sum % 10 === 0;
    },
  },
  {
    type: "SSN",
    pattern: /\b(?!000|666|9\d{2})([0-8]\d{2}|7([0-6]\d))([-]?)(?!00)\d\d\3(?!0000)\d{4}\b/g,
    severity: "critical",
    category: "US/Identity",
  },
  {
    type: "USPhone",
    pattern: /\b(?:\+1[\s-]?)?\(?[2-9]\d{2}\)?[\s-]?[2-9]\d{2}[\s-]?\d{4}\b/g,
    severity: "high",
    category: "US/Contact",
  },
  {
    type: "IPAddress",
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: "high",
    category: "Network",
  },
];

const ALL_RULES: PiiRule[] = [...INDIA_RULES, ...GLOBAL_RULES];

export function scanForPii(text: string): PiiMatch[] {
  const results: PiiMatch[] = [];
  for (const rule of ALL_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const match = m[0];
      if (rule.verify && !rule.verify(match)) continue;
      const preview =
        match.length <= 6
          ? "•".repeat(match.length)
          : `${match.slice(0, 2)}${"•".repeat(match.length - 4)}${match.slice(-2)}`;
      results.push({
        type: rule.type,
        value: match,
        preview,
        start: m.index,
        end: m.index + match.length,
      });
    }
  }
  return dedupeByPosition(results);
}

export function redactText(text: string, replacement: string = "[REDACTED]"): string {
  const matches = scanForPii(text);
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    result = result.slice(0, m.start) + replacement + result.slice(m.end);
  }
  return result;
}

function dedupeByPosition(matches: PiiMatch[]): PiiMatch[] {
  matches.sort((a, b) => a.start - b.start);
  const out: PiiMatch[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}
