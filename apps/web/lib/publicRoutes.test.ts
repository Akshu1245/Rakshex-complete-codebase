import { describe, expect, it } from "vitest";
import { isPublicPath, PUBLIC_PATH_PREFIXES } from "./publicRoutes";

describe("isPublicPath", () => {
  it("treats the legal center, DPA, and nested legal documents as public", () => {
    expect(PUBLIC_PATH_PREFIXES).toContain("/legal");
    expect(PUBLIC_PATH_PREFIXES).toContain("/dpa");
    expect(isPublicPath("/legal")).toBe(true);
    expect(isPublicPath("/legal/dpa")).toBe(true);
    expect(isPublicPath("/legal/sla")).toBe(true);
    expect(isPublicPath("/legal/aup")).toBe(true);
    expect(isPublicPath("/legal/refund")).toBe(true);
    expect(isPublicPath("/legal/subprocessors")).toBe(true);
    expect(isPublicPath("/legal/ai-transparency")).toBe(true);
    expect(isPublicPath("/dpa")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/cookies")).toBe(true);
    expect(isPublicPath("/trust")).toBe(true);
  });

  it("keeps evaluation marketing and invite paths public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/waitlist")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
  });

  it("does not make authenticated dashboard routes public", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/compliance")).toBe(false);
    expect(isPublicPath("/billing")).toBe(false);
    expect(isPublicPath("/collections")).toBe(false);
  });
});
