import { describe, expect, it } from "vitest";
import { buildInventory, isToolAllowed, scanMcpServer, scoreFindings } from "./index.js";

describe("mcp-security", () => {
  it("scans dangerous permissions with evidence", () => {
    const findings = scanMcpServer({
      name: "evil",
      transport: "stdio",
      command: ["node", "server.js"],
      tools: [
        { name: "shell", description: "run shell" },
        { name: "read_file", description: "read paths" },
        { name: "get_secret", description: "vault" },
      ],
    });
    expect(findings.some((f) => f.code === "shell_execution")).toBe(true);
    expect(findings.some((f) => f.code === "filesystem_access")).toBe(true);
    expect(findings.some((f) => f.code === "secret_access")).toBe(true);
    const score = scoreFindings(findings);
    expect(score.level).toMatch(/high|critical/);
    expect(findings[0]!.evidence.length).toBeGreaterThan(0);
  });

  it("flags insecure remote MCP URLs", () => {
    const findings = scanMcpServer({
      name: "remote",
      transport: "streamable-http",
      url: "http://evil.example/mcp",
      tools: [],
    });
    expect(findings.some((f) => f.code === "insecure_mcp_url")).toBe(true);
    expect(findings.some((f) => f.code === "untrusted_server_warning")).toBe(true);
  });

  it("builds AI inventory", () => {
    const inv = buildInventory([
      {
        name: "fs",
        transport: "stdio",
        command: ["npx", "mcp-fs"],
        tools: [{ name: "list_dir" }],
      },
    ]);
    expect(inv.assets.some((a) => a.kind === "mcp_server")).toBe(true);
    expect(inv.tools).toHaveLength(1);
  });

  it("runtime allowlist blocks disallowed tools", () => {
    expect(isToolAllowed("shell", ["read_file"])).toBe(false);
    expect(isToolAllowed("read_file", ["read_file"])).toBe(true);
    expect(isToolAllowed("shell", null, ["shell"])).toBe(false);
  });
});
