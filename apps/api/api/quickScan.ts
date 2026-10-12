/**
 * Public, unauthenticated quick-scan lead magnet.
 *
 *   POST /api/public/quick-scan
 *   body: { spec: <Postman|OpenAPI JSON> }
 *
 * Runs the deterministic scanner-core rules + credential detection on a pasted
 * API spec with NO authentication, returns a capped
 * set of findings, and prompts account creation for the full report. This is
 * the "instant scan / Oh Crap" acquisition moment described in the build guide.
 *
 * Safety: IP rate-limited and request-size capped. Remote URL fetching is
 * deliberately disabled on this unauthenticated endpoint: it could otherwise
 * become an SSRF primitive. The scanner is static and never makes requests to
 * targets described by the supplied document.
 */
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import express from "express";
import { logger } from "../_core/logger";
import {
  generateRealFindings,
  calculateRiskScore,
  getRiskLevel,
  type CollectionData,
} from "../utils/scanning";
import { scanCollectionForCredentials } from "../services/collectionCredentialScan";

const MAX_FINDINGS = 5;

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
        // Reject even a URL supplied alongside a document. Public clients must
        // never cause this API process to fetch attacker-controlled locations.
        if (req.body?.url !== undefined) {
          res.status(400).json({
            error: "Remote URL scanning is disabled. Paste or upload an OpenAPI/Postman document.",
          });
          return;
        }

        const spec: unknown = req.body?.spec;
        if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
          res.status(400).json({
            error: "Provide an OpenAPI or Postman document object in `spec`.",
          });
          return;
        }
        const doc = spec as Record<string, unknown>;
        if (
          !Array.isArray(doc.item) &&
          !(doc.paths && typeof doc.paths === "object" && !Array.isArray(doc.paths))
        ) {
          res.status(400).json({
            error: "The document must contain OpenAPI `paths` or Postman `item`.",
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
              ? "Create a free Rakshex account for the full report, remediation guidance, and credential details."
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
