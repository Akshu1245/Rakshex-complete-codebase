// @ts-nocheck  
import { describe, expect, it } from "vitest";

import { buildExport, csvEscape, streamExport } from "./dataExport";

const SAMPLE_ROWS = [
  { id: 1, name: "alpha", cost: 12.5, when: new Date("2026-01-01T00:00:00Z") },
  { id: 2, name: "beta", cost: 0, when: new Date("2026-01-02T00:00:00Z") },
  { id: 3, name: "comma, in name", cost: 7.1, when: new Date("2026-01-03T00:00:00Z") },
];

const REQ = {
  resource: "tokens",
  title: "Token Usage Report",
  rows: SAMPLE_ROWS,
};

describe("csvEscape", () => {
  it("returns plain text for safe values", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(true)).toBe("true");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes cells with comma / newline / quote", () => {
    expect(csvEscape("hi, friend")).toBe('"hi, friend"');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape('with "quotes"')).toBe('"with ""quotes"""');
  });

  it("neutralises CSV-injection prefixes", () => {
    expect(csvEscape("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(csvEscape("+1234")).toBe("'+1234");
    expect(csvEscape("-cmd")).toBe("'-cmd");
    expect(csvEscape("@sheet")).toBe("'@sheet");
  });

  it("serialises Date values to ISO 8601", () => {
    const d = new Date("2026-05-08T10:00:00Z");
    expect(csvEscape(d)).toBe("2026-05-08T10:00:00.000Z");
  });
});

describe("buildExport — JSON", () => {
  it("writes a valid envelope with rows and metadata", async () => {
    const r = await buildExport({ ...REQ, format: "json" });
    expect(r.contentType).toContain("application/json");
    expect(r.filename).toMatch(/^tokens_\d{4}-\d{2}-\d{2}\.json$/);
    expect(r.recordCount).toBe(3);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);

    const parsed = JSON.parse(r.body.toString("utf-8")) as {
      rows: Array<{ name: string; when: string }>;
      recordCount: number;
    };
    expect(parsed.recordCount).toBe(3);
    expect(parsed.rows[0].name).toBe("alpha");
    expect(parsed.rows[0].when).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("buildExport — NDJSON", () => {
  it("emits one JSON record per line, newline terminated", async () => {
    const r = await buildExport({ ...REQ, format: "ndjson" });
    expect(r.contentType).toContain("application/x-ndjson");
    const lines = r.body.toString("utf-8").trim().split("\n");
    expect(lines).toHaveLength(3);
    const parsed = JSON.parse(lines[1] as string) as { name: string };
    expect(parsed.name).toBe("beta");
  });
});

describe("buildExport — CSV", () => {
  it("emits header row and CRLF-terminated data rows", async () => {
    const r = await buildExport({ ...REQ, format: "csv" });
    expect(r.contentType).toContain("text/csv");
    const text = r.body.toString("utf-8");
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("name");
    // The "comma, in name" row must be quoted.
    expect(lines.some(l => l.includes('"comma, in name"'))).toBe(true);
  });

  it("uses columnHeaders override when provided", async () => {
    const r = await buildExport({
      ...REQ,
      format: "csv",
      columns: ["id", "name", "cost"],
      columnHeaders: { id: "ID", name: "Name", cost: "USD" },
    });
    const header = r.body.toString("utf-8").split("\r\n")[0];
    expect(header).toBe("ID,Name,USD");
  });
});

describe("buildExport — PDF", () => {
  it("produces a non-empty PDF with %PDF magic bytes", async () => {
    const r = await buildExport({ ...REQ, format: "pdf" });
    expect(r.contentType).toBe("application/pdf");
    expect(r.body.length).toBeGreaterThan(500);
    expect(r.body.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles empty row sets without crashing", async () => {
    const r = await buildExport({
      ...REQ,
      rows: [],
      format: "pdf",
    });
    expect(r.body.length).toBeGreaterThan(500);
    expect(r.recordCount).toBe(0);
  });
});

describe("streamExport", () => {
  it("CSV stream yields header + rows", async () => {
    const { stream, contentType, filename } = streamExport({ ...REQ, format: "csv" });
    expect(contentType).toContain("text/csv");
    expect(filename).toMatch(/\.csv$/);
    const chunks: Buffer[] = [];
    for await (const c of stream) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    }
    const body = Buffer.concat(chunks).toString("utf-8");
    expect(body.split("\r\n")[0]).toContain("id");
    expect(body.match(/\r\n/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("NDJSON stream yields one record per line", async () => {
    const { stream } = streamExport({ ...REQ, format: "ndjson" });
    const chunks: Buffer[] = [];
    for await (const c of stream) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    }
    const body = Buffer.concat(chunks).toString("utf-8");
    const lines = body.trim().split("\n");
    expect(lines).toHaveLength(3);
  });
});
