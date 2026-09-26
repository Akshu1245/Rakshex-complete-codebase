import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "./_lib";

describe("parseAdminEmails", () => {
  it("splits comma-separated addresses and normalizes them", () => {
    expect(parseAdminEmails("Boss@Rakshex.in, boss@gmail.com ")).toEqual([
      "boss@rakshex.in",
      "boss@gmail.com",
    ]);
  });

  it("returns [] for missing or blank input", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails(null)).toEqual([]);
    expect(parseAdminEmails("  , ")).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  it("matches the admin list case-insensitively", () => {
    expect(isAdminEmail("BOSS@rakshex.in", "boss@rakshex.in")).toBe(true);
    expect(isAdminEmail("boss@gmail.com", "boss@rakshex.in, boss@gmail.com")).toBe(true);
  });

  it("rejects non-admins and empty inputs", () => {
    expect(isAdminEmail("stranger@example.com", "boss@rakshex.in")).toBe(false);
    expect(isAdminEmail("boss@rakshex.in", "")).toBe(false);
    expect(isAdminEmail("boss@rakshex.in", undefined)).toBe(false);
    expect(isAdminEmail(null, "boss@rakshex.in")).toBe(false);
    expect(isAdminEmail(undefined, "boss@rakshex.in")).toBe(false);
  });
});
