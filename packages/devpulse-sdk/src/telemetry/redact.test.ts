import { describe, it, expect } from "vitest";
import { redactPII, hashContent } from "./redact.js";

describe("redactPII", () => {
  it("redacts email addresses", () => {
    const result = redactPII("Contact john@example.com for help");
    expect(result.text).toContain("[EMAIL_REDACTED]");
    expect(result.text).not.toContain("john@example.com");
    expect(result.redactedTypes).toContain("email");
  });

  it("redacts phone numbers", () => {
    const result = redactPII("Call me at 555-123-4567");
    expect(result.text).toContain("[PHONE_REDACTED]");
    expect(result.text).not.toContain("555-123-4567");
    expect(result.redactedTypes).toContain("phone");
  });

  it("redacts credit card numbers", () => {
    const result = redactPII("Card: 4111-1111-1111-1111");
    expect(result.text).toContain("[CREDIT_CARD_REDACTED]");
    expect(result.text).not.toContain("4111-1111-1111-1111");
  });

  it("redacts IP addresses", () => {
    const result = redactPII("Server at 192.168.1.1 is down");
    expect(result.text).toContain("[IP_REDACTED]");
    expect(result.text).not.toContain("192.168.1.1");
  });

  it("redacts OpenAI-style API keys", () => {
    const result = redactPII("Using key sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(result.redactedTypes).toContain("api_key");
    expect(result.text).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
  });

  it("redacts AWS access keys", () => {
    const result = redactPII("Key: AKIAIOSFODNN7EXAMPLE");
    expect(result.redactedTypes).toContain("aws_key");
    expect(result.text).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("counts total redactions correctly", () => {
    const result = redactPII("Email alice@foo.com and bob@bar.com please");
    expect(result.redactionCount).toBe(2);
  });

  it("returns unchanged text when nothing to redact", () => {
    const result = redactPII("The weather is nice today");
    expect(result.text).toBe("The weather is nice today");
    expect(result.redactionCount).toBe(0);
    expect(result.redactedTypes).toEqual([]);
  });

  it("handles empty string", () => {
    const result = redactPII("");
    expect(result.text).toBe("");
    expect(result.redactionCount).toBe(0);
  });

  // Indian PII — DPDP 2023
  it("redacts Aadhaar numbers", () => {
    const result = redactPII("My Aadhaar is 1234 5678 9012");
    expect(result.text).toContain("[AADHAAR_REDACTED]");
    expect(result.redactedTypes).toContain("aadhaar");
  });

  it("redacts PAN numbers", () => {
    const result = redactPII("PAN: ABCDE1234F");
    expect(result.text).toContain("[PAN_REDACTED]");
    expect(result.redactedTypes).toContain("pan");
  });

  it("redacts IFSC codes", () => {
    const result = redactPII("IFSC: SBIN0001234 for transfer");
    expect(result.text).toContain("[IFSC_REDACTED]");
    expect(result.redactedTypes).toContain("ifsc");
  });

  it("redacts Indian passport numbers", () => {
    const result = redactPII("Passport J1234567");
    expect(result.text).toContain("[PASSPORT_REDACTED]");
    expect(result.redactedTypes).toContain("passport_in");
  });
});

describe("hashContent", () => {
  it("produces consistent 64-char hex hash", () => {
    const h1 = hashContent("hello world");
    const h2 = hashContent("hello world");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h1)).toBe(true);
  });

  it("produces different hashes for different content", () => {
    expect(hashContent("hello")).not.toBe(hashContent("world"));
  });
});
