/**
 * Public, unauthenticated quick-scan lead magnet.
 *
 *   POST /api/public/quick-scan
 *   body: { spec: <Postman|OpenAPI JSON>, format? }  OR  { url: <spec url> }
 *
 * Runs the deterministic scanner-core rules + credential detection on a pasted
 * API spec (or one fetched from a URL) with NO authentication, returns a capped
 * set of findings, and prompts account creation for the full report. This is
 * the "instant scan / Oh Crap" acquisition moment described in the build guide.
 *
 * Safety: IP rate-limited, request-size capped, and SSRF-guarded when fetching
 * a spec URL. It never persists anything and never makes requests to the
 * scanned API itself (the scan is static analysis of the spec).
 */
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import express from "express";
import { logger } from "../_core/logger";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { buildValidatedScanUrl, validateScanTarget } from "../utils/validateScanTarget";
import {
  generateRealFindings,
  calculateRiskScore,
  getRiskLevel,
  type CollectionData,
} from "../utils/scanning";
import { scanCollectionForCredentials } from "../services/collectionCredentialScan";

const MAX_FINDINGS = 5;
const MAX_SPEC_BYTES = 2 * 1024 * 1024; // 2MB

const quickScanLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: 10, // 10 public scans per IP per day
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Quick-scan limit reached. Create a free account for unlimited scans.",
  },
});

export function registerQuickScanRoute(app: Express): void {
  app.post(
    "/api/public/quick-scan",
    quickScanLimiter,
    express.json({ limit: "2mb" }),
    async (req: Request, res: Response) => {
      try {
        let spec: unknown = req.body?.spec;

        // Optionally fetch the spec from a URL (SSRF-guarded).
        if (!spec && typeof req.body?.url === "string") {
          const check = await validateScanTarget(req.body.url);
          if (
            !check.ok ||
            !check.hostname ||
            (check.protocol !== "http:" && check.protocol !== "https:")
          ) {
            res.status(400).json({ error: `Blocked target: ${check.reason ?? "invalid"}` });
            return;
          }
          const safeHref = buildValidatedScanUrl({
            protocol: check.protocol,
            hostname: check.hostname,
            pathname: check.pathname,
            search: check.search,
          });
          // Fetch only the rebuilt URL — never raw req.body.url.
          const resp = await fetchWithTimeout(safeHref, { timeoutMs: 5000 });
          if (!resp.ok) {
            res.status(400).json({ error: `Could not fetch spec (HTTP ${resp.status})` });
            return;
          }
          const text = await resp.text();
          if (text.length > MAX_SPEC_BYTES) {
            res.status(413).json({ error: "Spec too large for quick scan" });
            return;
          }
          try {
            spec = JSON.parse(text);
          } catch {
            res.status(400).json({ error: "Fetched spec is not valid JSON" });
            return;
          }
        }

        if (!spec || typeof spec !== "object") {
          res.status(400).json({
            error: "Provide a Postman/OpenAPI spec in `spec`, or a `url` to fetch one.",
          });
          return;
        }

        const collectionData = spec as CollectionData;
        const allFindings = generateRealFindings(collectionData);
        const credentialFindings = scanCollectionForCredentials(collectionData);
        const riskScore = calculateRiskScore(allFindings);
        const riskLevel = getRiskLevel(riskScore);

        const capped = allFindings.slice(0, MAX_FINDINGS).map((f) => ({
          title: f.title,
          severity: f.severity,
          category: f.category,
          endpoint: (f as { endpoint?: string }).endpoint,
          method: (f as { method?: string }).method,
          // Remediation is intentionally withheld in the free preview.
        }));

        res.json({
          riskScore,
          riskLevel,
          totalFindings: allFindings.length,
          exposedCredentials: credentialFindings.length,
          findings: capped,
          truncated: allFindings.length > MAX_FINDINGS,
          message:
            allFindings.length > MAX_FINDINGS || credentialFindings.length > 0
              ? "Create a free DevPulse account for the full report, remediation guidance, and credential details."
              : "No issues in the free preview — sign up to run a full OWASP + credential scan.",
          upgradeUrl: "/register",
        });
      } catch (err) {
        logger.error({ err }, "[QuickScan] error");
        res.status(500).json({ error: "Quick scan failed. Please try again." });
      }
    },
  );
}
