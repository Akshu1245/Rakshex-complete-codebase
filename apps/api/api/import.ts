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
  importCollectionSpec,
  type ImportSource,
  type ColumnMapping,
} from "../services/importCompetitor";
import { recordImportHistory, getImportHistory } from "../db";

/** Frontend source aliases → canonical importCompetitor source ids. */
const SOURCE_ALIASES: Record<string, ImportSource> = {
  csv: "universal_csv",
  json: "universal_json",
};

function normalizeSource(raw: string): ImportSource {
  return (SOURCE_ALIASES[raw] ?? raw) as ImportSource;
}

const COLLECTION_SOURCES = new Set<ImportSource>(["postman", "openapi", "insomnia", "bruno"]);

export function registerImportRoutes(app: Express) {
  /**
   * POST /api/import/preview
   * Body: { source, data, columnMapping? }
   * Preview what will be imported without committing.
   */
  app.post("/api/import/preview", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const source = normalizeSource(req.body.source as string);
      const data = req.body.data;

      if (!source || !data) {
        res.status(400).json({ error: "source and data are required" });
        return;
      }

      // Collection/API-spec formats preview via the secure collection parser.
      if (COLLECTION_SOURCES.has(source)) {
        res.json(previewImport("universal_json", data));
        return;
      }

      let preview;
      switch (source) {
        case "helicone":
        case "portkey":
        case "lakera":
        case "langsmith":
        case "universal_csv":
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

      const source = normalizeSource(req.body.source as string);
      const data = req.body.data;
      const columnMapping = req.body.columnMapping as ColumnMapping[] | undefined;
      const name = typeof req.body.name === "string" ? req.body.name : undefined;

      if (!source || !data) {
        res.status(400).json({ error: "source and data are required" });
        return;
      }

      let result;
      if (COLLECTION_SOURCES.has(source)) {
        result = await importCollectionSpec(
          userId,
          source as "postman" | "openapi" | "insomnia" | "bruno",
          data,
          name,
        );
      } else {
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
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const history = await getImportHistory(user.id);

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
          id: "postman",
          name: "Postman",
          description: "Import a Postman Collection v2.1 export (auto-scanned for secrets + risks)",
          formats: ["json"],
          requiresColumnMapping: false,
        },
        {
          id: "openapi",
          name: "OpenAPI / Swagger",
          description: "Import an OpenAPI 3 / Swagger 2 spec (JSON or YAML)",
          formats: ["json", "yaml"],
          requiresColumnMapping: false,
        },
        {
          id: "insomnia",
          name: "Insomnia",
          description: "Import an Insomnia v4 export (converted + scanned)",
          formats: ["json"],
          requiresColumnMapping: false,
        },
        {
          id: "bruno",
          name: "Bruno",
          description: "Import a Bruno JSON export",
          formats: ["json"],
          requiresColumnMapping: false,
        },
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
