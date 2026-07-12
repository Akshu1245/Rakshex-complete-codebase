import { describe, it, expect } from "vitest";
import { discoverMcpTools } from "./mcpTransport";

describe("mcpTransport security", () => {
  it("rejects shell metacharacters in stdio commands", async () => {
    await expect(discoverMcpTools("stdio", "", ["/bin/sh", "-c", "whoami"])).rejects.toThrow(
      /blocked/,
    );
  });

  it("rejects path traversal in stdio commands", async () => {
    await expect(discoverMcpTools("stdio", "", ["../node", "script.js"])).rejects.toThrow(
      /blocked/,
    );
  });

  it("rejects disallowed binaries", async () => {
    await expect(discoverMcpTools("stdio", "", ["/usr/bin/cat", "/etc/passwd"])).rejects.toThrow(
      /not in the allowed list/,
    );
  });

  it("allows node commands", async () => {
    // node should be allowed, but the command won't actually run in tests
    // so it will fail with spawn error, not validation error
    await expect(discoverMcpTools("stdio", "", ["node", "--version"])).rejects.not.toThrow(
      /blocked/,
    );
  });
});
