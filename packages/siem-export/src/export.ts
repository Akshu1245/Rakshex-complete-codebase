import type { SecurityEventRecord, SiemExportResult, SiemFormat } from "./types.js";

const CEF_SEVERITY: Record<SecurityEventRecord["severity"], number> = {
  info: 1,
  low: 3,
  medium: 5,
  high: 7,
  critical: 9,
};

function escapeCef(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/=/g, "\\=").replace(/\n/g, "\\n").replace(/\r/g, "");
}

function toCef(event: SecurityEventRecord): string {
  const sev = CEF_SEVERITY[event.severity];
  const ext: string[] = [
    `rt=${Date.parse(event.timestamp) || 0}`,
    `cs1=${escapeCef(event.workspaceId)}`,
    `cs1Label=workspaceId`,
    `msg=${escapeCef(event.message)}`,
    `act=${escapeCef(event.action)}`,
    `src=${escapeCef(event.source)}`,
  ];
  if (event.actor) ext.push(`suser=${escapeCef(event.actor)}`);
  if (event.fields) {
    let i = 2;
    for (const [k, v] of Object.entries(event.fields)) {
      if (v == null) continue;
      ext.push(`cs${i}=${escapeCef(String(v))}`);
      ext.push(`cs${i}Label=${escapeCef(k)}`);
      i += 1;
      if (i > 6) break;
    }
  }
  return `CEF:0|Rakshex|Rakshex|1.0|${escapeCef(event.action)}|${escapeCef(event.message)}|${sev}|${ext.join(" ")}`;
}

function toSyslog(event: SecurityEventRecord): string {
  // RFC 5424-ish structured data
  const pri = 14; // user.notice
  const ts = event.timestamp;
  const sd = `[rakshex@32473 workspaceId="${event.workspaceId}" action="${event.action}" severity="${event.severity}"]`;
  return `<${pri}>1 ${ts} rakshex rakshex ${event.id} - ${sd} ${event.message}`;
}

function toSplunkHec(event: SecurityEventRecord): string {
  return JSON.stringify({
    time: Math.floor((Date.parse(event.timestamp) || Date.now()) / 1000),
    source: event.source,
    sourcetype: "rakshex:security",
    event: {
      id: event.id,
      workspaceId: event.workspaceId,
      actor: event.actor,
      action: event.action,
      severity: event.severity,
      message: event.message,
      ...event.fields,
    },
  });
}

/**
 * Export security/audit events for customer SIEM pipelines.
 * Never include secrets — callers must redact before export.
 */
export function exportSiemEvents(
  events: SecurityEventRecord[],
  format: SiemFormat,
): SiemExportResult {
  let body: string;
  let contentType: string;

  switch (format) {
    case "ndjson":
      body = events.map((e) => JSON.stringify(e)).join("\n");
      contentType = "application/x-ndjson";
      break;
    case "cef":
      body = events.map(toCef).join("\n");
      contentType = "text/plain";
      break;
    case "syslog":
      body = events.map(toSyslog).join("\n");
      contentType = "text/plain";
      break;
    case "splunk_hec":
      body = events.map(toSplunkHec).join("\n");
      contentType = "application/json";
      break;
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported SIEM format: ${String(_exhaustive)}`);
    }
  }

  return { format, body, contentType, recordCount: events.length };
}
