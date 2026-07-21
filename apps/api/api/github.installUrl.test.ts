import { describe, it, expect } from "vitest";
import { resolveGithubAppInstallUrl } from "../services/githubApp";

describe("resolveGithubAppInstallUrl", () => {
  it("returns null when unset", () => {
    expect(resolveGithubAppInstallUrl("", "")).toBeNull();
  });

  it("prefers slug", () => {
    expect(resolveGithubAppInstallUrl("rakshex", "12345")).toBe(
      "https://github.com/apps/rakshex/installations/new",
    );
  });

  it("falls back to numeric app id", () => {
    expect(resolveGithubAppInstallUrl("", "987654")).toBe(
      "https://github.com/apps/987654/installations/new",
    );
  });
});
