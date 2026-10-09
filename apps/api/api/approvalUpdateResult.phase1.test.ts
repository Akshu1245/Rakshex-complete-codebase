import { describe, expect, it } from "vitest";
import { affectedApprovalCount } from "./approvalUpdateResult";

describe("approval update result parsing", () => {
  it("accepts pg QueryResult rows", () => {
    expect(affectedApprovalCount({ rows: [{ approval_id: "appr_one" }], rowCount: 1 })).toBe(1);
  });
  it("accepts Drizzle rows arrays", () => {
    expect(affectedApprovalCount([{ approval_id: "appr_one" }])).toBe(1);
  });
  it("rejects empty or unrecognized updates", () => {
    expect(affectedApprovalCount({ rows: [], rowCount: 0 })).toBe(0);
    expect(affectedApprovalCount(null)).toBe(0);
  });
});
