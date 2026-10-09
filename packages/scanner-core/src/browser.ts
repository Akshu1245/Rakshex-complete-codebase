/**
 * Browser-safe public entrypoint. Never import ./index.ts here: it exports
 * filesystem-based secret scanning, which cannot run in the browser.
 * API/OpenAPI/Postman static rules only; no network calls or external models.
 */
export { runScan, calculateRiskScore, getRiskLevel } from "./engine.js";
export { normalizeCollection, redactUrlSecrets } from "./normalize.js";
export type { RuleFinding, ScanResult, Severity } from "./types.js";
