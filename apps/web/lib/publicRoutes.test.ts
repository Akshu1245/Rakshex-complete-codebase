import { describe, expect, it } from "vitest";
import { isPublicPath } from "./publicRoutes";

describe("isPublicPath", () => {
  it("treats legal center routes as public so they do not wait on auth.me", () => {
    expect(isPublicPath("/legal")).toBe(true);
    expect(isPublicPath("/legal/dpa")).toBe(true);
    expect(isPublicPath("/legal/sla")).toBe(true);
  });

  it("keeps evaluation marketing and invite paths public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/pricing")).toBe(true);
    expect(isPublicPath("/waitlist")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
  });

  it("still gates authenticated product surfaces", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/billing")).toBe(false);
    expect(isPublicPath("/collections")).toBe(false);
  });
});
