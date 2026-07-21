import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertSameWorkspace, requireUser } from "./authorization";

vi.mock("./workspaceContext", () => ({
  getWorkspaceRole: vi.fn(),
}));

import { getWorkspaceRole } from "./workspaceContext";
import {
  requireWorkspaceMembership,
  requireWorkspacePermission,
  assertWorkspacePermission,
  checkWorkspacePermission,
} from "./authorization";

describe("authorization middleware", () => {
  beforeEach(() => {
    vi.mocked(getWorkspaceRole).mockReset();
  });

  it("requireUser throws 401 when missing", () => {
    try {
      requireUser(null);
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });

  it("requireWorkspaceMembership throws 403 for non-member", async () => {
    vi.mocked(getWorkspaceRole).mockResolvedValue(null);
    await expect(requireWorkspaceMembership(1, 99)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireWorkspacePermission throws 403 on role denial", async () => {
    vi.mocked(getWorkspaceRole).mockResolvedValue("viewer");
    await expect(requireWorkspacePermission(1, 1, "api_keys", "write")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requireWorkspacePermission allows admin for api_keys write", async () => {
    vi.mocked(getWorkspaceRole).mockResolvedValue("admin");
    const role = await requireWorkspacePermission(1, 1, "api_keys", "write");
    expect(role).toBe("admin");
  });

  it("assertWorkspacePermission is an alias of requireWorkspacePermission", async () => {
    vi.mocked(getWorkspaceRole).mockResolvedValue("owner");
    expect(assertWorkspacePermission).toBe(requireWorkspacePermission);
    await expect(assertWorkspacePermission(1, 1, "collections", "read")).resolves.toBe("owner");
  });

  it("checkWorkspacePermission returns false for non-member", async () => {
    vi.mocked(getWorkspaceRole).mockResolvedValue(null);
    expect(await checkWorkspacePermission(1, 1, "projects", "read")).toBe(false);
  });

  it("assertSameWorkspace blocks cross-tenant", () => {
    expect(() => assertSameWorkspace(2, 1)).toThrow(TRPCError);
    expect(() => assertSameWorkspace(1, 1)).not.toThrow();
  });

  it("never trusts invalid workspace ids", async () => {
    await expect(requireWorkspaceMembership(0, 1)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
