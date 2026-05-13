// @ts-nocheck  
import { describe, expect, it } from "vitest";

import {
  ALL_RESOURCES,
  ALL_ROLES,
  PermissionDeniedError,
  assertPermission,
  hasPermission,
  minRoleFor,
  roleSatisfies,
  summarisePermissions,
} from "./rbac";

describe("roleSatisfies", () => {
  it("owner satisfies every required role", () => {
    for (const r of ALL_ROLES) {
      expect(roleSatisfies("owner", r)).toBe(true);
    }
  });

  it("viewer satisfies only viewer", () => {
    expect(roleSatisfies("viewer", "viewer")).toBe(true);
    expect(roleSatisfies("viewer", "editor")).toBe(false);
    expect(roleSatisfies("viewer", "admin")).toBe(false);
    expect(roleSatisfies("viewer", "owner")).toBe(false);
  });

  it("editor satisfies viewer + editor", () => {
    expect(roleSatisfies("editor", "viewer")).toBe(true);
    expect(roleSatisfies("editor", "editor")).toBe(true);
    expect(roleSatisfies("editor", "admin")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("viewers cannot write any resource", () => {
    for (const resource of ALL_RESOURCES) {
      expect(hasPermission("viewer", resource, "write")).toBe(false);
    }
  });

  it("viewers can read every resource except billing and sso", () => {
    for (const resource of ALL_RESOURCES) {
      const expected = resource !== "billing" && resource !== "sso";
      expect(hasPermission("viewer", resource, "read")).toBe(expected);
    }
  });

  it("editors can manage tenant data but cannot manage members or sso", () => {
    expect(hasPermission("editor", "collections", "write")).toBe(true);
    expect(hasPermission("editor", "alerts", "delete")).toBe(true);
    expect(hasPermission("editor", "members", "write")).toBe(false);
    expect(hasPermission("editor", "policies", "write")).toBe(false);
    expect(hasPermission("editor", "sso", "read")).toBe(false);
  });

  it("admins can manage members, policies, sso, webhooks", () => {
    expect(hasPermission("admin", "members", "write")).toBe(true);
    expect(hasPermission("admin", "policies", "write")).toBe(true);
    expect(hasPermission("admin", "sso", "write")).toBe(true);
    expect(hasPermission("admin", "webhooks", "delete")).toBe(true);
  });

  it("only owners can delete the workspace or change billing primary", () => {
    expect(hasPermission("admin", "workspace", "delete")).toBe(false);
    expect(hasPermission("owner", "workspace", "delete")).toBe(true);
    expect(hasPermission("admin", "billing", "write")).toBe(false);
    expect(hasPermission("owner", "billing", "write")).toBe(true);
  });

  it("only owners can delete SSO providers", () => {
    expect(hasPermission("admin", "sso", "delete")).toBe(false);
    expect(hasPermission("owner", "sso", "delete")).toBe(true);
  });
});

describe("minRoleFor", () => {
  it("matches the matrix for representative cells", () => {
    expect(minRoleFor("workspace", "delete")).toBe("owner");
    expect(minRoleFor("collections", "write")).toBe("editor");
    expect(minRoleFor("collections", "read")).toBe("viewer");
    expect(minRoleFor("billing", "read")).toBe("admin");
  });
});

describe("summarisePermissions", () => {
  it("returns a full permission matrix for the role", () => {
    const summary = summarisePermissions("editor");
    expect(summary.role).toBe("editor");
    expect(summary.permissions.collections.read).toBe(true);
    expect(summary.permissions.collections.write).toBe(true);
    expect(summary.permissions.members.write).toBe(false);
    expect(summary.permissions.workspace.delete).toBe(false);
  });

  it("includes every resource", () => {
    const summary = summarisePermissions("admin");
    for (const r of ALL_RESOURCES) {
      expect(summary.permissions[r]).toBeDefined();
      expect(summary.permissions[r].read).toBeTypeOf("boolean");
    }
  });
});

describe("assertPermission", () => {
  it("returns silently when permission granted", () => {
    expect(() => assertPermission("admin", "members", "write")).not.toThrow();
  });

  it("throws PermissionDeniedError with structured fields", () => {
    try {
      assertPermission("viewer", "collections", "write");
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PermissionDeniedError);
      const e = err as PermissionDeniedError;
      expect(e.resource).toBe("collections");
      expect(e.action).toBe("write");
      expect(e.required).toBe("editor");
      expect(e.actual).toBe("viewer");
      expect(e.code).toBe("PERMISSION_DENIED");
    }
  });
});
