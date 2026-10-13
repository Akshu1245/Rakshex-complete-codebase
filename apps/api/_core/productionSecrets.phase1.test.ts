import { describe, expect, it } from "vitest";
import { isSafeProductionSecret } from "./productionSecrets";

describe("production secret policy", () => {
  it("rejects real repo sample and development secrets", () => {
    for (const value of [
      "replace-with-32-plus-char-random-secret",
      "dev-only-jwt-secret-min-32-chars-rakshex",
      "change-me-to-a-32-character-secret-please",
      "placeholder-secret-is-not-a-real-random-key",
    ]) {
      expect(isSafeProductionSecret(value)).toBe(false);
    }
  });
  it("accepts a long randomly generated hexadecimal secret", () => {
    expect(isSafeProductionSecret("f3b8e021c96a4d17e603a2b8f51c0749")).toBe(true);
  });
});
