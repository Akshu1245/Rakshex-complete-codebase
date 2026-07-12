// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertWorkspacePermission,
  checkWorkspacePermission,
  clearMembershipCache,
  getWorkspaceRole,
  invalidateMembershipCache,
} from "./workspaceContext";
import { PermissionDeniedError } from "./rbac";

vi.mock("../db", () => ({
  getWorkspaceMembership: vi.fn(),
}));

import * as db from "../db";

const getMembership = vi.mocked(db.getWorkspaceMembership);

beforeEach(() => {
  clearMembershipCache();
  getMembership.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getWorkspaceRole", () => {
  it("returns the role for an active member", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "editor",
      active: true,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    // legacy "editor" is normalized to "developer"
    expect(await getWorkspaceRole(7, 42)).toBe("developer");
  });

  it("returns null when the user is not a member", async () => {
    getMembership.mockResolvedValue(null);
    expect(await getWorkspaceRole(7, 42)).toBeNull();
  });

  it("returns null when the membership is inactive", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "admin",
      active: false,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    expect(await getWorkspaceRole(7, 42)).toBeNull();
  });

  it("caches results within the 60s TTL", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "owner",
      active: true,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    await getWorkspaceRole(7, 42);
    await getWorkspaceRole(7, 42);
    await getWorkspaceRole(7, 42);
    expect(getMembership).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after invalidate", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "owner",
      active: true,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    await getWorkspaceRole(7, 42);
    invalidateMembershipCache(7, 42);
    await getWorkspaceRole(7, 42);
    expect(getMembership).toHaveBeenCalledTimes(2);
  });
});

describe("assertWorkspacePermission", () => {
  it("returns the role when permission is granted", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "admin",
      active: true,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    const role = await assertWorkspacePermission(7, 42, "members", "write");
    expect(role).toBe("admin");
  });

  it("throws when caller is not a member", async () => {
    getMembership.mockResolvedValue(null);
    await expect(assertWorkspacePermission(7, 42, "collections", "read")).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it("throws when role lacks the permission", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "viewer",
      active: true,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    await expect(assertWorkspacePermission(7, 42, "collections", "write")).rejects.toThrow(
      PermissionDeniedError,
    );
  });
});

describe("checkWorkspacePermission", () => {
  it("returns { allowed: false, role: null } for non-members without throwing", async () => {
    getMembership.mockResolvedValue(null);
    const r = await checkWorkspacePermission(7, 42, "workspace", "delete");
    expect(r).toEqual({ allowed: false, role: null });
  });

  it("returns { allowed, role } reflecting the matrix", async () => {
    getMembership.mockResolvedValue({
      id: 1,
      workspaceId: 7,
      userId: 42,
      role: "editor",
      active: true,
      invitedBy: null,
      invitedAt: null,
      joinedAt: new Date(),
    });
    const r1 = await checkWorkspacePermission(7, 42, "collections", "write");
    expect(r1).toEqual({ allowed: true, role: "developer" });
    invalidateMembershipCache(7, 42);
    const r2 = await checkWorkspacePermission(7, 42, "members", "write");
    expect(r2).toEqual({ allowed: false, role: "developer" });
  });
});
