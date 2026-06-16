/**
 * Import API — Migrate from competitors to Rakshex.
 *
 * Endpoints:
 *   POST /api/import/preview   — Preview import data before committing
 *   POST /api/import/execute    — Execute the import
 *   GET  /api/import/history    — List past imports
 */

import type { Express, Request, Response } from "express";
import { logger } from "../_core/logger";
import { sdk } from "../_core/sdk";
import {
  previewImport,
  importHelicone,
  importPortkey,
  importLakera,
  importLangSmith,
  importUniversalCSV,
  importUniversalJSON,
  type ImportSource,
  type ColumnMapping,
} from "../services/importCompetitor";
import { recordImportHistory, getImportHistory } from "../db";

export function registerImportRoutes(app: Express) {
  /**
   * POST /api/import/preview
   * Body: { source, data, columnMapping? }
   * Preview what will be imported without committing.
   */
  app.post("/api/import/preview", (req: Request, res: Response) => {
    try {
      const source = req.body.source as ImportSource;
      const data = req.body.data;
      const columnMapping = req.body.columnMapping as ColumnMapping[] | undefined;

      if (!source || !data) {
        res.status(400).json({ error: "source and data are required" });
        return;
      }

      let preview;
      switch (source) {
        case "helicone":
        case "portkey":
        case "lakera":
        case "langsmith":
          preview = previewImport(source, data);
          break;
        case "universal_csv":
          if (!columnMapping) {
            res.status(400).json({ error: "columnMapping required for CSV imports" });
            return;
          }
          preview = previewImport(source, data);
          break;
        case "universal_json":
          preview = previewImport(source, data);
          break;
        default:
          res.status(400).json({ error: `Unknown source: ${source}` });
          return;
      }

      res.json(preview);
    } catch (err) {
      logger.error({ err }, "[Import] Preview error");
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/import/execute
   * Body: { source, data, columnMapping? }
   * Execute the import. Requires authenticated user.
   */
  app.post("/api/import/execute", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const userId = user.id;

      const source = req.body.source as ImportSource;
      const data = req.body.data;
      const columnMapping = req.body.columnMapping as ColumnMapping[] | undefined;

      if (!source || !data) {
        res.status(400).json({ error: "source and data are required" });
        return;
      }

      let result;
      switch (source) {
        case "helicone":
          result = await importHelicone(userId, data);
          break;
        case "portkey":
          result = await importPortkey(userId, data);
          break;
        case "lakera":
          result = await importLakera(userId, data);
          break;
        case "langsmith":
          result = await importLangSmith(userId, data);
          break;
        case "universal_csv":
          if (!columnMapping) {
            res.status(400).json({ error: "columnMapping required for CSV imports" });
            return;
          }
          result = await importUniversalCSV(userId, data, columnMapping);
          break;
        case "universal_json":
          result = await importUniversalJSON(userId, data);
          break;
        default:
          res.status(400).json({ error: `Unknown source: ${source}` });
          return;
      }

      await recordImportHistory({
        id: `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        source,
        recordsImported: result.recordsImported,
        recordsSkipped: result.recordsSkipped,
        collectionsCreated: result.collectionsCreated,
        errors: result.errors,
        result,
      });

      res.json(result);
    } catch (err) {
      logger.error({ err }, "[Import] Execute error");
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * GET /api/import/history
   * Query: ?userId=1
   * List past imports for a user.
   */
  app.get("/api/import/history", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.query.userId as string, 10) || (req as any).user?.id || 1;
      const history = await getImportHistory(userId);

      res.json({ imports: history });
    } catch (err) {
      logger.error({ err }, "[Import] History error");
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * GET /api/import/supported-sources
   * List all supported import sources with descriptions.
   */
  app.get("/api/import/supported-sources", (_req: Request, res: Response) => {
    res.json({
      sources: [
        {
          id: "helicone",
          name: "Helicone",
          description: "Import request logs from Helicone (JSON export)",
          formats: ["json"],
          requiresColumnMapping: false,
        },
        {
          id: "portkey",
          name: "Portkey",
          description: "Import request logs from Portkey (JSON export)",
          formats: ["json"],
          requiresColumnMapping: false,
        },
        {
          id: "lakera",
          name: "Lakera Guard",
          description: "Import Lakera Guard policy configuration",
          formats: ["json"],
          requiresColumnMapping: false,
        },
        {
          id: "langsmith",
          name: "LangSmith",
          description: "Import LLM traces from LangSmith (JSON export)",
          formats: ["json"],
          requiresColumnMapping: false,
        },
        {
          id: "universal_csv",
          name: "Universal CSV",
          description:
            "Import any CSV with column mapping (Helicone CSV, Portkey CSV, custom formats)",
          formats: ["csv"],
          requiresColumnMapping: true,
        },
        {
          id: "universal_json",
          name: "Universal JSON",
          description: "Import any JSON with auto-detection of common schemas",
          formats: ["json"],
          requiresColumnMapping: false,
        },
      ],
    });
  });
}
