/**
 * Data export service.
 *
 * Generic, multi-format exporter for tabular tenant data. Used by the
 * compliance, token-analytics, gateway-audit, and alert-events surfaces so
 * we don't reinvent CSV escaping or PDF generation in every router.
 *
 * Supported formats:
 *   - "json"   — pretty-printed UTF-8 text. Always full-document.
 *   - "ndjson" — one JSON record per line; safe for stream-and-parse.
 *   - "csv"    — RFC-4180-style escaping (double-quoted, internal "" escaped),
 *                CRLF line endings, leading-equals/`+`/`-`/`@` neutralised
 *                with a leading apostrophe to prevent CSV-injection attacks.
 *   - "pdf"    — landscape table with title, generated date, summary line.
 *                Streaming output via pdfkit so 50K rows don't blow memory.
 *
 * Every export emits a `DataExport` envelope with body bytes + content type
 * + a stable filename. The downloader endpoint just streams `body` to the
 * HTTP response with the right Content-Disposition header.
 */

import { Buffer } from "buffer";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export type ExportFormat = "json" | "ndjson" | "csv" | "pdf";

export type ExportRow = Record<string, string | number | boolean | null | Date>;

export interface ExportRequest {
  format: ExportFormat;
  /** Title shown on PDF title page; ignored for non-PDF formats. */
  title: string;
  /** Resource identifier used in the generated filename. */
  resource: string;
  /** Column order. If omitted we infer from the first row. */
  columns?: string[];
  /** Optional column header overrides — pretty names for the report. */
  columnHeaders?: Record<string, string>;
  rows: ExportRow[];
}

export interface DataExport {
  /** Raw bytes; for CSV/JSON/NDJSON this is utf-8 text. */
  body: Buffer;
  contentType: string;
  filename: string;
  /** Number of rows exported (for the "X records exported" UI banner). */
  recordCount: number;
  /** SHA-256 fingerprint of the body — useful for tamper-evident audit. */
  sha256: string;
}

/* ─── Public entry points ─────────────────────────────────────────────── */

/**
 * Build an in-memory export envelope. For very large data sets prefer
 * `streamExport` which yields chunks instead of buffering.
 */
export async function buildExport(req: ExportRequest): Promise<DataExport> {
  switch (req.format) {
    case "json":
      return buildJsonExport(req);
    case "ndjson":
      return buildNdjsonExport(req);
    case "csv":
      return buildCsvExport(req);
    case "pdf":
      return await buildPdfExport(req);
  }
}

/**
 * Stream variant. Returns a Node Readable that emits the export bytes
 * in chunks. Useful for HTTP responses on >10MB exports where buffering
 * would block the event loop.
 */
export function streamExport(req: ExportRequest): {
  stream: Readable;
  contentType: string;
  filename: string;
} {
  const filename = makeFilename(req);
  switch (req.format) {
    case "json":
      return {
        stream: streamJson(req),
        contentType: "application/json; charset=utf-8",
        filename,
      };
    case "ndjson":
      return {
        stream: streamNdjson(req),
        contentType: "application/x-ndjson; charset=utf-8",
        filename,
      };
    case "csv":
      return {
        stream: streamCsv(req),
        contentType: "text/csv; charset=utf-8",
        filename,
      };
    case "pdf":
      return {
        stream: streamPdf(req),
        contentType: "application/pdf",
        filename,
      };
  }
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function makeFilename(req: ExportRequest): string {
  const ts = new Date().toISOString().slice(0, 10);
  const safe = req.resource.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 64);
  return `${safe}_${ts}.${req.format}`;
}

function inferColumns(rows: ExportRow[], explicit?: string[]): string[] {
  if (explicit && explicit.length > 0) return explicit;
  const seen = new Set<string>();
  for (const r of rows.slice(0, 50)) {
    for (const k of Object.keys(r)) seen.add(k);
  }
  return Array.from(seen);
}

function valueToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v);
}

/**
 * RFC-4180 CSV cell escape + injection-attack neutralisation. Cells that
 * begin with =, +, -, or @ (Excel formula triggers) are prefixed with a
 * single apostrophe so spreadsheet apps treat them as text.
 */
export function csvEscape(cell: unknown): string {
  let s = valueToText(cell);
  if (
    s.length > 0 &&
    (s[0] === "=" || s[0] === "+" || s[0] === "-" || s[0] === "@")
  ) {
    s = "'" + s;
  }
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function sha256Hex(b: Buffer): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(b).digest("hex");
}

/* ─── JSON ─────────────────────────────────────────────────────────────── */

async function buildJsonExport(req: ExportRequest): Promise<DataExport> {
  const body = Buffer.from(
    JSON.stringify(
      {
        title: req.title,
        resource: req.resource,
        exportedAt: new Date().toISOString(),
        recordCount: req.rows.length,
        rows: req.rows,
      },
      jsonReplacer,
      2
    ),
    "utf-8"
  );
  return {
    body,
    contentType: "application/json; charset=utf-8",
    filename: makeFilename(req),
    recordCount: req.rows.length,
    sha256: await sha256Hex(body),
  };
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function streamJson(req: ExportRequest): Readable {
  // Single chunk; JSON is "atomic" anyway. For very big rows callers
  // should choose ndjson.
  return Readable.from([
    JSON.stringify(
      {
        title: req.title,
        resource: req.resource,
        exportedAt: new Date().toISOString(),
        recordCount: req.rows.length,
        rows: req.rows,
      },
      jsonReplacer,
      2
    ),
  ]);
}

/* ─── NDJSON ───────────────────────────────────────────────────────────── */

async function buildNdjsonExport(req: ExportRequest): Promise<DataExport> {
  const lines: string[] = [];
  for (const r of req.rows) {
    lines.push(JSON.stringify(r, jsonReplacer));
  }
  const body = Buffer.from(lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf-8");
  return {
    body,
    contentType: "application/x-ndjson; charset=utf-8",
    filename: makeFilename(req),
    recordCount: req.rows.length,
    sha256: await sha256Hex(body),
  };
}

function streamNdjson(req: ExportRequest): Readable {
  let i = 0;
  return new Readable({
    read() {
      if (i >= req.rows.length) {
        this.push(null);
        return;
      }
      // Emit ~256 rows per chunk to amortise V8/socket overhead.
      const end = Math.min(i + 256, req.rows.length);
      const slice = req.rows.slice(i, end);
      i = end;
      this.push(slice.map(r => JSON.stringify(r, jsonReplacer)).join("\n") + "\n");
    },
  });
}

/* ─── CSV ──────────────────────────────────────────────────────────────── */

async function buildCsvExport(req: ExportRequest): Promise<DataExport> {
  const cols = inferColumns(req.rows, req.columns);
  const headers = cols.map(c => req.columnHeaders?.[c] ?? c);
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of req.rows) {
    lines.push(cols.map(c => csvEscape(r[c])).join(","));
  }
  const body = Buffer.from(lines.join("\r\n") + "\r\n", "utf-8");
  return {
    body,
    contentType: "text/csv; charset=utf-8",
    filename: makeFilename(req),
    recordCount: req.rows.length,
    sha256: await sha256Hex(body),
  };
}

function streamCsv(req: ExportRequest): Readable {
  const cols = inferColumns(req.rows, req.columns);
  const headers = cols.map(c => req.columnHeaders?.[c] ?? c);
  let i = 0;
  let wroteHeader = false;
  return new Readable({
    read() {
      if (!wroteHeader) {
        wroteHeader = true;
        this.push(headers.map(csvEscape).join(",") + "\r\n");
        return;
      }
      if (i >= req.rows.length) {
        this.push(null);
        return;
      }
      const end = Math.min(i + 256, req.rows.length);
      const slice = req.rows.slice(i, end);
      i = end;
      this.push(
        slice
          .map(r => cols.map(c => csvEscape(r[c])).join(","))
          .join("\r\n") + "\r\n"
      );
    },
  });
}

/* ─── PDF ──────────────────────────────────────────────────────────────── */

async function buildPdfExport(req: ExportRequest): Promise<DataExport> {
  const stream = streamPdf(req);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  return {
    body,
    contentType: "application/pdf",
    filename: makeFilename(req),
    recordCount: req.rows.length,
    sha256: await sha256Hex(body),
  };
}

function streamPdf(req: ExportRequest): Readable {
  const cols = inferColumns(req.rows, req.columns);
  const headers = cols.map(c => req.columnHeaders?.[c] ?? c);

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 40,
    info: {
      Title: req.title,
      Author: "Ojas Security",
      Subject: req.resource,
      Producer: "Ojas Security",
    },
  });

  // Title block
  doc.fontSize(20).fillColor("#111827").text(req.title);
  doc.moveDown(0.25);
  doc.fontSize(10).fillColor("#6b7280").text(
    `Resource: ${req.resource}    Records: ${req.rows.length}    Generated: ${new Date().toISOString()}`
  );
  doc.moveDown(0.5);
  doc
    .moveTo(doc.x, doc.y)
    .lineTo(doc.page.width - 40, doc.y)
    .strokeColor("#e5e7eb")
    .stroke();
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const tableLeft = 40;
  const tableWidth = doc.page.width - 80;
  const colWidth = Math.floor(tableWidth / Math.max(headers.length, 1));

  // Header row
  doc.fontSize(9).fillColor("#111827");
  for (let i = 0; i < headers.length; i++) {
    doc.text(String(headers[i]), tableLeft + i * colWidth, tableTop, {
      width: colWidth - 6,
      ellipsis: true,
    });
  }
  doc
    .moveTo(tableLeft, tableTop + 14)
    .lineTo(tableLeft + tableWidth, tableTop + 14)
    .strokeColor("#9ca3af")
    .stroke();

  // Data rows
  doc.fontSize(8).fillColor("#1f2937");
  let y = tableTop + 18;
  const rowHeight = 14;
  const pageBottom = doc.page.height - 60;

  for (const row of req.rows) {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = 40;
    }
    for (let i = 0; i < cols.length; i++) {
      doc.text(valueToText(row[cols[i] as string]), tableLeft + i * colWidth, y, {
        width: colWidth - 6,
        ellipsis: true,
      });
    }
    y += rowHeight;
  }

  doc.end();
  return doc as unknown as Readable;
}
