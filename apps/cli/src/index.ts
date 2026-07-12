#!/usr/bin/env node
/**
 * @rakshex/cli — foundation CLI scaffold.
 *
 * TODO(product): implement login, scan, policy check, report, doctor.
 * Does not invent network or scan product behavior beyond listing package capability.
 */

import { PRODUCT_NAME, getPublicConfig } from "@rakshex/config";
import { listRuleIds } from "@rakshex/scanner-core";

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

function printHelp(): void {
  console.log(`${PRODUCT_NAME} CLI (foundation scaffold)`);
  console.log(`Config: ${JSON.stringify(getPublicConfig())}`);
  console.log("");
  console.log("Commands (stubs):");
  console.log("  help              Show this help");
  console.log("  rules             List scanner-core rule ids");
  console.log("  doctor            Environment sanity checks (partial)");
  console.log("");
  console.log("TODO(product): login, scan, policy check, report");
}

function doctor(): number {
  const issues: string[] = [];
  if (!process.env.DATABASE_URL) {
    issues.push("DATABASE_URL not set (optional for offline rule list)");
  }
  if (issues.length === 0) {
    console.log("doctor: ok (minimal checks)");
    return 0;
  }
  for (const i of issues) console.warn(`doctor: ${i}`);
  return 0;
}

switch (cmd) {
  case "rules":
    console.log(listRuleIds().join("\n"));
    process.exit(0);
    break;
  case "doctor":
    process.exit(doctor());
    break;
  case "help":
  case "--help":
  case "-h":
    printHelp();
    process.exit(0);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
}
