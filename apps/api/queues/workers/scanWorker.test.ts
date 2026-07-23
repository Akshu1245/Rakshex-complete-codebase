import { describe, expect, it } from "vitest";
import { resolveScanOptions, type ScanJobData } from "./scanWorker";

describe("resolveScanOptions", () => {
  it("uses nested options.scanType when present (enqueueScan / GitHub shape)", () => {
    const data: ScanJobData = {
      userId: 1,
      collectionId: "col_1",
      scanType: "full",
      options: {
        scanType: "shadow_api",
        triggeredBy: "github_push",
        branch: "main",
      },
    };
    expect(resolveScanOptions(data)).toEqual({
      scanType: "shadow_api",
      triggeredBy: "github_push",
      branch: "main",
    });
  });

  it("falls back to flat scanType (scanning.startScan shape)", () => {
    const data: ScanJobData = {
      userId: 1,
      collectionId: "col_1",
      scanType: "quick",
    };
    expect(resolveScanOptions(data)).toEqual({
      scanType: "quick",
      triggeredBy: "user",
      prNumber: undefined,
      branch: undefined,
      commitSha: undefined,
    });
  });

  it("defaults to full when neither shape provides scanType", () => {
    const data: ScanJobData = { userId: 1, collectionId: "col_1" };
    expect(resolveScanOptions(data).scanType).toBe("full");
  });
});
