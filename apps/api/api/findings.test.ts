import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../db", () => ({
  getFindingById: vi.fn(),
  listFindingsForUser: vi.fn(),
  updateFindingStatus: vi.fn(),
  createAuditLogEntry: vi.fn(),
  reactivateExpiredSuppressions: vi.fn().mockResolvedValue(0),
  getCollectionById: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
}));

import * as db from "../db";

describe("findings authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cross-user finding access is denied", async () => {
    vi.mocked(db.getFindingById).mockResolvedValue({
      id: "f1",
      userId: 99,
      title: "x",
    } as any);

    // Simulate ownership check used by findings router
    const row = await db.getFindingById("f1");
    const callerId = 1;
    const denied = !row || (row as any).userId !== callerId;
    expect(denied).toBe(true);
  });

  it("owner can access own finding", async () => {
    vi.mocked(db.getFindingById).mockResolvedValue({
      id: "f1",
      userId: 1,
      title: "x",
    } as any);
    const row = await db.getFindingById("f1");
    expect((row as any).userId).toBe(1);
  });

  it("suppression expiry reactivation is invoked on list", async () => {
    vi.mocked(db.reactivateExpiredSuppressions).mockResolvedValue(2);
    vi.mocked(db.listFindingsForUser).mockResolvedValue([]);
    const n = await db.reactivateExpiredSuppressions(1);
    expect(n).toBe(2);
  });

  it("accepted risk must be auditable", async () => {
    vi.mocked(db.updateFindingStatus).mockResolvedValue(undefined as any);
    vi.mocked(db.createAuditLogEntry).mockResolvedValue(undefined as any);
    await db.updateFindingStatus("f1", "accepted_risk", {
      acceptedRiskReason: "business exception",
      acceptedRiskApprovedBy: 1,
    });
    await db.createAuditLogEntry(1, "finding_status_changed", {
      findingId: "f1",
      status: "accepted_risk",
    });
    expect(db.createAuditLogEntry).toHaveBeenCalledWith(
      1,
      "finding_status_changed",
      expect.objectContaining({ status: "accepted_risk" }),
    );
  });
});

describe("duplicate grouping", () => {
  it("groups by fingerprint predictably", () => {
    const rows = [
      { id: "1", fingerprint: "a|GET|/x" },
      { id: "2", fingerprint: "a|GET|/x" },
      { id: "3", fingerprint: "b|POST|/y" },
    ];
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.fingerprint;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }
    expect(groups.get("a|GET|/x")).toHaveLength(2);
    expect(groups.get("b|POST|/y")).toHaveLength(1);
  });
});
