/** Browser-only Quick Scan. Nothing here POSTs or sends the uploaded spec. */
import { parse as parseYaml } from "yaml";
import {
  runScan,
  calculateRiskScore,
  getRiskLevel,
  type RuleFinding,
} from "@rakshex/scanner-core/browser";

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export type QuickScanReport = {
  schemaVersion: 1;
  mode: "static-api-spec";
  scannedAt: string;
  fileName: string;
  inputFormat: "json" | "yaml";
  endpointCount: number;
  ruleCount: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: RuleFinding[];
  limitation: string;
};

const LIMITATION =
  "Static indicators in OpenAPI or Postman files, not confirmation of exploitable runtime vulnerabilities. No requests to target APIs are made.";

export function parseQuickScanInput(
  text: string,
  fileName = "pasted-spec.json",
): { document: unknown; format: "json" | "yaml" } {
  if (!text.trim()) throw new Error("Please choose or paste a non-empty API specification.");
  if (new TextEncoder().encode(text).byteLength > MAX_INPUT_BYTES) {
    throw new Error("Input is larger than 5 MiB. Use the offline CLI for larger specs.");
  }
  const yamlFile = /\.ya?ml$/i.test(fileName);
  const jsonFile = /\.json$/i.test(fileName);
  const isJson = jsonFile || (!yamlFile && /^[\s]*[\[{]/.test(text));
  let document: unknown;
  try {
    document = isJson ? JSON.parse(text) : parseYaml(text, { strict: true, uniqueKeys: true });
  } catch (err) {
    throw new Error(`Invalid ${isJson ? "JSON" : "YAML"}: ${(err as Error).message}`);
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("Expected a Postman collection or OpenAPI document object.");
  }
  const doc = document as Record<string, unknown>;
  if (
    !Array.isArray(doc.item) &&
    !(doc.paths && typeof doc.paths === "object" && !Array.isArray(doc.paths))
  ) {
    throw new Error("No Postman 'item' array or OpenAPI 'paths' object found.");
  }
  return { document, format: isJson ? "json" : "yaml" };
}

export function scanLocally(text: string, fileName = "pasted-spec.json"): QuickScanReport {
  const { document, format } = parseQuickScanInput(text, fileName);
  const result = runScan(document);
  if (result.endpointCount === 0) {
    throw new Error("No API operations or Postman requests were found; scan not run.");
  }
  const riskScore = calculateRiskScore(result.findings);
  return {
    schemaVersion: 1,
    mode: "static-api-spec",
    scannedAt: new Date().toISOString(),
    fileName: fileName.replace(/[\\/\r\n\t]/g, "_").slice(0, 120),
    inputFormat: format,
    endpointCount: result.endpointCount,
    ruleCount: result.rulesRun.length,
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    findings: result.findings,
    limitation: LIMITATION,
  };
}

const cell = (value: unknown): string =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]/g, " ");

export function reportAsMarkdown(report: QuickScanReport): string {
  return [
    "# RaksHex Quick Scan — Static API Findings",
    "",
    `Scanned: ${cell(report.scannedAt)}`,
    `File: ${cell(report.fileName)}`,
    `Operations: ${report.endpointCount} | Rules: ${report.ruleCount}`,
    `Risk: ${report.riskScore}/100 (${report.riskLevel})`,
    "",
    "> " + report.limitation,
    "",
    "| Severity | Rule | Method | Endpoint | Finding | Recommendation |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.findings.map(
      (f) =>
        `| ${cell(f.severity)} | ${cell(f.ruleId)} | ${cell(f.method)} | ${cell(f.endpoint)} | ${cell(f.title)} | ${cell(f.remediation)} |`,
    ),
    "",
    `Total findings: ${report.findings.length}`,
    "",
  ].join("\n");
}
