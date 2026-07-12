// @ts-nocheck
import { describe, expect, it } from "vitest";

import {
  ALL_RESOURCES,
  ALL_ROLES,
  PermissionDeniedError,
  assertPermission,
  hasPermission,
  minRoleFor,
  normalizeRole,
  roleSatisfies,
  summarisePermissions,
} from "./rbac";

describe("normalizeRole", () => {
  it("maps editor → developer", () => {
    expect(normalizeRole("editor")).toBe("developer");
  });
});

describe("roleSatisfies", () => {
  it("owner satisfies every required role", () => {
    for (const r of ALL_ROLES) {
      expect(roleSatisfies("owner", r)).toBe(true);
    }
  });

  it("viewer satisfies only viewer", () => {
    expect(roleSatisfies("viewer", "viewer")).toBe(true);
    expect(roleSatisfies("viewer", "developer")).toBe(false);
    expect(roleSatisfies("viewer", "admin")).toBe(false);
  });

  it("developer satisfies viewer + developer", () => {
    expect(roleSatisfies("developer", "viewer")).toBe(true);
    expect(roleSatisfies("developer", "developer")).toBe(true);
    expect(roleSatisfies("developer", "admin")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("viewers cannot write any resource", () => {
    for (const resource of ALL_RESOURCES) {
      expect(hasPermission("viewer", resource, "write")).toBe(false);
    }
  });

  it("developers can write collections and projects", () => {
    expect(hasPermission("developer", "collections", "write")).toBe(true);
    expect(hasPermission("developer", "projects", "write")).toBe(true);
    expect(hasPermission("developer", "members", "write")).toBe(false);
  });

  it("security_lead can manage policies and security", () => {
    expect(hasPermission("security_lead", "policies", "write")).toBe(true);
    expect(hasPermission("security_lead", "security", "write")).toBe(true);
    expect(hasPermission("security_lead", "sso", "write")).toBe(true);
  });

  it("billing_admin can only manage billing", () => {
    expect(hasPermission("billing_admin", "billing", "write")).toBe(true);
    expect(hasPermission("billing_admin", "collections", "write")).toBe(false);
    expect(hasPermission("billing_admin", "workspace", "delete")).toBe(false);
  });

  it("analyst can export data but not mutate collections", () => {
    expect(hasPermission("analyst", "data_export", "write")).toBe(true);
    expect(hasPermission("analyst", "collections", "read")).toBe(true);
    expect(hasPermission("analyst", "collections", "write")).toBe(false);
  });

  it("only owners can delete the workspace", () => {
    expect(hasPermission("admin", "workspace", "delete")).toBe(false);
    expect(hasPermission("owner", "workspace", "delete")).toBe(true);
  });

  it("legacy editor alias works for collections write", () => {
    expect(hasPermission("editor", "collections", "write")).toBe(true);
  });
});

describe("minRoleFor", () => {
  it("matches the matrix for representative cells", () => {
    expect(minRoleFor("workspace", "delete")).toBe("owner");
    expect(minRoleFor("collections", "write")).toBe("developer");
    expect(minRoleFor("api_keys", "write")).toBe("admin");
  });
});

describe("summarisePermissions", () => {
  it("returns a full permission matrix for the role", () => {
    const summary = summarisePermissions("developer");
    expect(summary.role).toBe("developer");
    expect(summary.permissions.collections.read).toBe(true);
    expect(summary.permissions.collections.write).toBe(true);
    expect(summary.permissions.members.write).toBe(false);
  });

  it("includes every resource", () => {
    const summary = summarisePermissions("admin");
    for (const r of ALL_RESOURCES) {
      expect(summary.permissions[r]).toBeDefined();
    }
  });
});

describe("assertPermission", () => {
  it("throws PermissionDeniedError", () => {
    expect(() => assertPermission("viewer", "members", "write")).toThrow(PermissionDeniedError);
  });
});
