#!/usr/bin/env node
/**
 * @rakshex/cli — local + CI scanner
 *
 * Commands: login | configure | scan | policy | report | doctor | rules | help
 * Outputs:  terminal | json | sarif
 * Offline:  scan uses @rakshex/scanner-core (deterministic, no network)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { PRODUCT_NAME, getPublicConfig } from "@rakshex/config";
import {
  runScan,
  listRuleIds,
  calculateRiskScore,
  getRiskLevel,
  type RuleFinding,
} from "@rakshex/scanner-core";

const CONFIG_DIR = join(homedir(), ".rakshex");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const BASELINE_PATH = join(CONFIG_DIR, "baseline.json");

type OutputFormat = "terminal" | "json" | "sarif";

interface CliConfig {
  apiKey?: string;
  apiUrl?: string;
  failOn?: Array<"Critical" | "High" | "Medium" | "Low">;
  ignoreRules?: string[];
}

function loadConfig(): CliConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

function saveConfig(cfg: CliConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  const cmd = args.shift() ?? "help";
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd, flags, positional };
}

function printHelp(): void {
  console.log(`${PRODUCT_NAME} CLI`);
  console.log(`Config: ${JSON.stringify(getPublicConfig())}`);
  console.log(`
Usage:
  rakshex login --api-key <key> [--api-url <url>]
  rakshex configure --fail-on Critical,High [--ignore-rules id1,id2]
  rakshex scan <file-or-dir> [--format terminal|json|sarif] [--changed-only] [--baseline] [--offline]
  rakshex policy check <file> [--format json]
  rakshex report <file> [--format sarif|json]
  rakshex doctor
  rakshex rules

Exit codes (scan):
  0  clean / below threshold
  1  findings at or above fail-on severity
  2  usage / parse error
`);
}

function loadCollection(filePath: string): unknown {
  const text = readFileSync(filePath, "utf8");
  const ext = extname(filePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    // Minimal YAML: require JSON-compatible docs or use scanner after crude conversion
    // Prefer JSON for CI; for YAML use simple openapi key detection via JSON if possible
    try {
      return JSON.parse(text);
    } catch {
      // Best-effort: wrap as openapi if looks like YAML openapi without full parser in CLI
      if (text.includes("openapi:") || text.includes("swagger:")) {
        // Convert very simple openapi yaml is hard without dep — try dynamic import of yaml if present
        try {
          const yaml = require("yaml") as { parse: (s: string) => unknown };
          return yaml.parse(text);
        } catch {
          throw new Error(
            `YAML requires the 'yaml' package. Convert to JSON or install yaml in the CLI environment.`,
          );
        }
      }
      throw new Error(`Cannot parse ${filePath} as JSON/YAML`);
    }
  }
  return JSON.parse(text);
}

function collectScanTargets(root: string, changedOnly: boolean): string[] {
  const abs = resolve(root);
  if (statSync(abs).isFile()) return [abs];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "dist") continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(json|ya?ml)$/i.test(name)) {
        // Heuristic: openapi/postman filenames or content later
        if (/openapi|swagger|postman|collection|api/i.test(name) || !changedOnly) {
          out.push(p);
        }
      }
    }
  };
  walk(abs);
  return out;
}

function fingerprintSet(findings: RuleFinding[]): Set<string> {
  return new Set(findings.map((f) => f.fingerprint));
}

function toSarif(findings: RuleFinding[], toolName = "rakshex-cli") {
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            informationUri: "https://rakshex.in",
            rules: listRuleIds().map((id) => ({ id, name: id })),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          level:
            f.severity === "Critical" || f.severity === "High"
              ? "error"
              : f.severity === "Medium"
                ? "warning"
                : "note",
          message: { text: f.title },
          properties: {
            confidence: f.confidence,
            fingerprint: f.fingerprint,
            remediation: f.remediation,
          },
          locations: f.endpoint
            ? [
                {
                  physicalLocation: {
                    artifactLocation: { uri: f.endpoint },
                    region: {
                      snippet: { text: `${f.method ?? ""} ${f.endpoint}`.trim() },
                    },
                  },
                },
              ]
            : [],
        })),
      },
    ],
  };
}

function printTerminal(findings: RuleFinding[], score: number, level: string): void {
  console.log(`Risk score: ${score} (${level})`);
  console.log(`Findings: ${findings.length}`);
  for (const f of findings) {
    console.log(
      `  [${f.severity}/${f.confidence}] ${f.ruleId}: ${f.title}${
        f.endpoint ? ` @ ${f.method ?? ""} ${f.endpoint}` : ""
      }`,
    );
  }
}

function severityRank(s: string): number {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[s] ?? 0;
}

function shouldFail(
  findings: RuleFinding[],
  failOn: Array<"Critical" | "High" | "Medium" | "Low">,
): boolean {
  const min = Math.min(...failOn.map(severityRank));
  return findings.some((f) => severityRank(f.severity) >= min);
}

function cmdLogin(flags: Record<string, string | boolean>): number {
  const apiKey = String(flags["api-key"] ?? flags.apiKey ?? "");
  if (!apiKey || apiKey.length < 8) {
    console.error("Usage: rakshex login --api-key <key> [--api-url <url>]");
    return 2;
  }
  const cfg = loadConfig();
  cfg.apiKey = apiKey;
  if (flags["api-url"]) cfg.apiUrl = String(flags["api-url"]);
  saveConfig(cfg);
  console.log("Logged in. API key stored in ~/.rakshex/config.json (mode 600 recommended).");
  return 0;
}

function cmdConfigure(flags: Record<string, string | boolean>): number {
  const cfg = loadConfig();
  if (flags["fail-on"]) {
    cfg.failOn = String(flags["fail-on"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as CliConfig["failOn"];
  }
  if (flags["ignore-rules"]) {
    cfg.ignoreRules = String(flags["ignore-rules"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  saveConfig(cfg);
  console.log("Config updated:", JSON.stringify(cfg, null, 2));
  return 0;
}

function cmdScan(positional: string[], flags: Record<string, string | boolean>): number {
  const target = positional[0];
  if (!target) {
    console.error("Usage: rakshex scan <file-or-dir> [--format terminal|json|sarif]");
    return 2;
  }
  const format = (String(flags.format ?? "terminal") as OutputFormat) || "terminal";
  const cfg = loadConfig();
  const failOn = cfg.failOn ?? ["Critical", "High"];
  const ignore = new Set(cfg.ignoreRules ?? []);

  let all: RuleFinding[] = [];
  const files = collectScanTargets(target, Boolean(flags["changed-only"]));
  if (files.length === 0) {
    console.error("No scannable OpenAPI/Postman JSON/YAML files found.");
    return 2;
  }

  for (const file of files) {
    try {
      const data = loadCollection(file);
      const result = runScan(data);
      all.push(...result.findings.filter((f) => !ignore.has(f.ruleId)));
    } catch (err) {
      console.error(`Skip ${file}: ${(err as Error).message}`);
    }
  }

  // Dedupe by fingerprint
  const byFp = new Map<string, RuleFinding>();
  for (const f of all) byFp.set(f.fingerprint, f);
  all = [...byFp.values()];

  if (flags.baseline) {
    if (existsSync(BASELINE_PATH)) {
      const base = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { fingerprints: string[] };
      const known = new Set(base.fingerprints);
      all = all.filter((f) => !known.has(f.fingerprint));
    }
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        { fingerprints: [...fingerprintSet(all)], updatedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  }

  const score = calculateRiskScore(all);
  const level = getRiskLevel(score);

  if (format === "json") {
    console.log(JSON.stringify({ score, level, findings: all }, null, 2));
  } else if (format === "sarif") {
    console.log(JSON.stringify(toSarif(all), null, 2));
  } else {
    printTerminal(all, score, level);
  }

  if (flags.out) {
    writeFileSync(
      String(flags.out),
      JSON.stringify(format === "sarif" ? toSarif(all) : { score, level, findings: all }, null, 2),
    );
  }

  return shouldFail(all, failOn) ? 1 : 0;
}

function cmdPolicy(positional: string[], flags: Record<string, string | boolean>): number {
  // Offline policy: treat scanner Critical/High as policy violations
  const target = positional[0] ?? positional[1];
  if (!target) {
    console.error("Usage: rakshex policy check <file>");
    return 2;
  }
  const data = loadCollection(target);
  const findings = runScan(data).findings.filter(
    (f) => f.severity === "Critical" || f.severity === "High",
  );
  const result = {
    passed: findings.length === 0,
    violations: findings.map((f) => ({
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
    })),
  };
  if (flags.format === "json" || flags.format === true) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.passed ? "policy: PASS" : `policy: FAIL (${findings.length} violations)`);
    for (const v of result.violations) {
      console.log(`  - [${v.severity}] ${v.ruleId}: ${v.title}`);
    }
  }
  return result.passed ? 0 : 1;
}

function cmdReport(positional: string[], flags: Record<string, string | boolean>): number {
  return cmdScan(positional, { ...flags, format: flags.format ?? "sarif" });
}

function cmdDoctor(): number {
  const issues: string[] = [];
  const cfg = loadConfig();
  if (!cfg.apiKey)
    issues.push("No API key (run: rakshex login --api-key …) — offline scan still works");
  try {
    listRuleIds();
  } catch {
    issues.push("scanner-core failed to load");
  }
  console.log(`Node: ${process.version}`);
  console.log(`Config: ${CONFIG_PATH} ${existsSync(CONFIG_PATH) ? "ok" : "missing"}`);
  console.log(`Rules: ${listRuleIds().length}`);
  console.log(`Product: ${PRODUCT_NAME}`);
  if (issues.length === 0) {
    console.log("doctor: ok");
    return 0;
  }
  for (const i of issues) console.warn(`doctor: ${i}`);
  return 0;
}

const { cmd, flags, positional } = parseArgs(process.argv.slice(2));

let code = 0;
switch (cmd) {
  case "login":
    code = cmdLogin(flags);
    break;
  case "configure":
  case "config":
    code = cmdConfigure(flags);
    break;
  case "scan":
    code = cmdScan(positional, flags);
    break;
  case "policy":
    code = cmdPolicy(positional, flags);
    break;
  case "report":
    code = cmdReport(positional, flags);
    break;
  case "doctor":
    code = cmdDoctor();
    break;
  case "rules":
    console.log(listRuleIds().join("\n"));
    code = 0;
    break;
  case "help":
  case "--help":
  case "-h":
    printHelp();
    code = 0;
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    code = 2;
}

process.exit(code);
