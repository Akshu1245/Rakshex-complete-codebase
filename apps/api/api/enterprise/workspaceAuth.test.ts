/**
 * Enterprise workspace authorization tests.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  requireEnterpriseRead,
  requireEnterpriseWrite,
  assertWorkspaceMatch,
} from "./workspaceAuth";
import { PermissionDeniedError } from "../../services/rbac";

vi.mock("../../services/workspaceContext", () => ({
  assertWorkspacePermission: vi.fn(),
}));

import { assertWorkspacePermission } from "../../services/workspaceContext";

describe("enterprise workspaceAuth", () => {
  beforeEach(() => {
    vi.mocked(assertWorkspacePermission).mockReset();
  });

  it("requireEnterpriseRead delegates to assertWorkspacePermission with read action", async () => {
    vi.mocked(assertWorkspacePermission).mockResolvedValueOnce("viewer");
    const role = await requireEnterpriseRead(42, 7);
    expect(role).toBe("viewer");
    expect(assertWorkspacePermission).toHaveBeenCalledWith(42, 7, "policies", "read");
  });

  it("requireEnterpriseWrite delegates with write action", async () => {
    vi.mocked(assertWorkspacePermission).mockResolvedValueOnce("admin");
    const role = await requireEnterpriseWrite(42, 7);
    expect(role).toBe("admin");
    expect(assertWorkspacePermission).toHaveBeenCalledWith(42, 7, "policies", "write");
  });

  it("maps PermissionDeniedError to FORBIDDEN TRPCError", async () => {
    vi.mocked(assertWorkspacePermission).mockRejectedValueOnce(
      new PermissionDeniedError("policies", "read", "viewer"),
    );
    await expect(requireEnterpriseRead(99, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Workspace access denied",
    });
  });

  it("assertWorkspaceMatch throws NOT_FOUND on mismatch", () => {
    expect(() => assertWorkspaceMatch(1, 2)).toThrow(/not found/i);
    expect(() => assertWorkspaceMatch(5, 5)).not.toThrow();
  });
});
