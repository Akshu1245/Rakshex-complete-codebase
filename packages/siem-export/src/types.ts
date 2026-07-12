export type SiemFormat = "ndjson" | "cef" | "syslog" | "splunk_hec";

export interface SecurityEventRecord {
  id: string;
  timestamp: string;
  workspaceId: string;
  actor?: string;
  action: string;
  severity: "low" | "medium" | "high" | "critical" | "info";
  source: string;
  message: string;
  /** Additional structured fields (no secrets). */
  fields?: Record<string, string | number | boolean | null>;
}

export interface SiemExportResult {
  format: SiemFormat;
  body: string;
  contentType: string;
  recordCount: number;
}
