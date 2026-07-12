import { describe, expect, it } from "vitest";
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
  normalizeRecoveryCode,
} from "./recoveryCodes";

describe("recovery codes", () => {
  it("generates unique codes", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("consume is single-use", () => {
    const codes = generateRecoveryCodes(3);
    const hashes = hashRecoveryCodes(codes);
    const remaining = consumeRecoveryCode(codes[0]!, hashes);
    expect(remaining).not.toBeNull();
    expect(remaining!).toHaveLength(2);
    // Same code again fails
    expect(consumeRecoveryCode(codes[0]!, remaining!)).toBeNull();
  });

  it("normalizes dashes and case", () => {
    expect(normalizeRecoveryCode("ab-cd")).toBe("ABCD");
  });
});
