// @ts-nocheck  
import { describe, expect, it } from "vitest";

import { resolveDisplayFields, ssoOpenId } from "./ssoJitProvision";

describe("ssoOpenId", () => {
  it("namespaces by provider id so two IdPs can't share an openId", () => {
    expect(ssoOpenId(1, "abc")).toBe("sso:1:abc");
    expect(ssoOpenId(2, "abc")).toBe("sso:2:abc");
    expect(ssoOpenId(1, "abc")).not.toBe(ssoOpenId(2, "abc"));
  });
});

describe("resolveDisplayFields", () => {
  it("uses the provided email when valid", () => {
    const r = resolveDisplayFields(
      { subject: "u1", email: "Alice@Example.com" },
      1
    );
    expect(r.email).toBe("alice@example.com");
  });

  it("falls back to a synthetic email when none provided", () => {
    const r = resolveDisplayFields({ subject: "u1" }, 7);
    expect(r.email).toBe("sso:7:u1@sso.local");
  });

  it("falls back to local-part of email when name is missing", () => {
    const r = resolveDisplayFields(
      { subject: "u1", email: "alice@example.com" },
      1
    );
    expect(r.name).toBe("alice");
  });

  it("uses subject when name and email are missing", () => {
    const r = resolveDisplayFields({ subject: "user-id-42" }, 1);
    expect(r.name).toBe("user-id-42");
  });

  it("prefers explicit name over derived names", () => {
    const r = resolveDisplayFields(
      { subject: "u1", email: "alice@example.com", name: "Alice Anderson" },
      1
    );
    expect(r.name).toBe("Alice Anderson");
  });

  it("trims name whitespace", () => {
    const r = resolveDisplayFields(
      { subject: "u1", name: "  Bob  " },
      1
    );
    expect(r.name).toBe("Bob");
  });

  it("ignores invalid emails missing @", () => {
    const r = resolveDisplayFields(
      { subject: "u1", email: "not-an-email" },
      3
    );
    expect(r.email).toBe("sso:3:u1@sso.local");
  });
});
