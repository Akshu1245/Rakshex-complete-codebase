import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIREWALL_AUTHORIZE_AND_RUN,
  FIREWALL_CLIENT,
  FIREWALL_EXECUTE_WITH_CREDENTIAL,
} from "../app/docs/firewallSnippets";

const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(webRoot, rel), "utf8");
}

describe("public docs hello-world", () => {
  it("keeps the Agent Firewall snippet aligned with the SDK README", () => {
    const sdkReadme = fs.readFileSync(path.join(repoRoot, "packages/sdk/README.md"), "utf8");
    expect(sdkReadme).toContain(FIREWALL_CLIENT);
    expect(sdkReadme).toContain(FIREWALL_AUTHORIZE_AND_RUN);
    expect(sdkReadme).toContain(FIREWALL_EXECUTE_WITH_CREDENTIAL);
  });

  it("leads /docs and /docs/agent-firewall with createAgentFirewallClient, not CLI scan", () => {
    const overview = read("app/docs/page.tsx");
    const firewall = read("app/docs/agent-firewall/page.tsx");

    for (const source of [overview, firewall]) {
      expect(source).toContain("createAgentFirewallClient");
      expect(source).not.toMatch(/npx RaksHex scan/);
      expect(source).not.toMatch(/1000\+\s+server tests/i);
      expect(source).not.toMatch(/SOC 2 audit in progress/i);
    }
  });

  it("does not advertise a working public npm install or certification copy in docs pages", () => {
    const docsDir = path.join(webRoot, "app/docs");
    const files = collectSource(docsDir);
    const violations: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const rel = path.relative(webRoot, file);
      if (/1000\+\s+server tests/i.test(source)) {
        violations.push(`${rel} still claims an exact server-test count`);
      }
      if (/SOC 2 audit in progress/i.test(source)) {
        violations.push(`${rel} still claims a SOC 2 audit in progress`);
      }
      if (/npm install @rakshex\/sdk/.test(source)) {
        violations.push(`${rel} documents npm install @rakshex/sdk`);
      }
      if (/npm install -g @rakshex\/cli/.test(source)) {
        violations.push(`${rel} documents npm install -g @rakshex/cli`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("does not redirect /get-started to public docs", () => {
    const nextConfig = read("next.config.js");
    expect(nextConfig).not.toMatch(/source:\s*"\/get-started"/);
  });
});

function collectSource(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSource(target);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [target];
  });
}
