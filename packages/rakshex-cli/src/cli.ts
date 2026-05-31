#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { scanCollectionForCredentials } from "./collectionCredentialScan.js";
import { generatePromptInjectionFindings, flattenCollection } from "./promptInjectionScan.js";

const program = new Command();

program
  .name("rakshex")
  .description("RaksHex security scanner CLI for API collections")
  .version("0.1.0");

/**
 * Coordinates scanner runs and returns all findings.
 */
export function scanCollection(collectionData: any) {
  const credentialFindings = scanCollectionForCredentials(collectionData);
  const injectionResult = generatePromptInjectionFindings(collectionData);
  const promptFindings = injectionResult.findings;

  const allFindings = [
    ...credentialFindings.map((f) => ({
      type: "credential",
      ruleId: f.ruleId,
      description: f.description,
      severity: f.severity === "critical" ? "Critical" : "High",
      matchPreview: f.matchPreview,
      line: f.line,
      path: f.path,
    })),
    ...promptFindings.map((f) => ({
      type: "prompt_injection",
      ruleId: f.payloadId,
      description: f.description,
      severity: f.severity,
      matchPreview: null,
      line: null,
      path: f.endpoint,
    })),
  ];

  return allFindings;
}

program
  .command("scan <file>")
  .description(
    "Scan a Postman or OpenAPI collection file for credentials and prompt injection risks",
  )
  .option("--json", "Output raw JSON findings")
  .action(async (file, options) => {
    const isJson = !!options.json;

    try {
      const filePath = path.resolve(file);
      const fileContent = await fs.readFile(filePath, "utf-8");
      let collectionData: any;
      try {
        collectionData = JSON.parse(fileContent);
      } catch (e) {
        if (isJson) {
          console.log(JSON.stringify({ error: "Failed to parse JSON file" }));
        } else {
          console.error(chalk.red(`Error: Failed to parse JSON file at ${filePath}`));
        }
        process.exit(1);
      }

      let spinner: any;
      if (!isJson) {
        console.log(chalk.cyan.bold("\n🛡️  RaksHex CLI Security Scanner v0.1.0"));
        console.log(chalk.gray(`Scanning: ${path.basename(filePath)}...\n`));
        spinner = ora("Running scans...").start();
      }

      // Run scans
      const allFindings = scanCollection(collectionData);

      const endpoints = flattenCollection(collectionData);
      const endpointCount = endpoints.length;

      // Calculate security score
      const criticalCount = allFindings.filter((f) => f.severity === "Critical").length;
      const highCount = allFindings.filter((f) => f.severity === "High").length;
      const mediumCount = allFindings.filter((f) => f.severity === "Medium").length;
      const score = Math.max(10, 100 - criticalCount * 20 - highCount * 10 - mediumCount * 5);

      if (isJson) {
        console.log(
          JSON.stringify(
            {
              scannedFile: path.basename(filePath),
              endpointsCount: endpointCount,
              securityScore: score,
              findings: allFindings,
            },
            null,
            2,
          ),
        );
        if (allFindings.length > 0) {
          process.exit(1);
        } else {
          process.exit(0);
        }
      }

      spinner.stop();

      // Printable Output
      if (allFindings.length === 0) {
        console.log(chalk.green.bold("✅ No findings found! Your collection is secure."));
        console.log(`\nEndpoints Scanned: ${chalk.bold(endpointCount)}`);
        console.log(`Security Score: ${chalk.green.bold(score + "/100")}\n`);
        process.exit(0);
      }

      console.log(chalk.bold(`Findings (${allFindings.length}):`));

      const getSeverityIcon = (severity: string) => {
        switch (severity) {
          case "Critical":
            return chalk.red("🔴 [Critical]");
          case "High":
            return chalk.yellow("🟠 [High]");
          case "Medium":
            return chalk.blue("🟡 [Medium]");
          case "Low":
            return chalk.gray("🔵 [Low]");
          default:
            return chalk.white("⚪ [Info]");
        }
      };

      for (const f of allFindings) {
        const icon = getSeverityIcon(f.severity);
        if (f.type === "credential") {
          console.log(
            `\n${icon} ${chalk.bold(f.description)}` +
              `\n   ${chalk.gray("Path:")} ${f.path}` +
              `\n   ${chalk.gray("Line:")} ${f.line}` +
              `\n   ${chalk.gray("Match:")} ${chalk.red(f.matchPreview)}`,
          );
        } else {
          console.log(
            `\n${icon} ${chalk.bold("Prompt Injection Risk in endpoint")} ${chalk.cyan(f.path)}` +
              `\n   ${chalk.gray("Description:")} ${f.description}`,
          );
        }
      }

      console.log("\n-------------------------------------------");
      console.log(`Endpoints Scanned: ${chalk.bold(endpointCount)}`);

      let scoreColor = chalk.red;
      if (score === 100) scoreColor = chalk.green;
      else if (score >= 80) scoreColor = chalk.yellow;

      console.log(`Security Score: ${scoreColor.bold(score + "/100")}`);
      console.log("-------------------------------------------\n");

      process.exit(1);
    } catch (err: any) {
      if (isJson) {
        console.log(JSON.stringify({ error: err.message || err }));
      } else {
        console.error(chalk.red(`Fatal Error: ${err.message || err}`));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
