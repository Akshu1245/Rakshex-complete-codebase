import {
  CONTROL_CATALOG,
  NON_CERTIFICATION_DISCLAIMER,
  type ControlDefinition,
  type ControlStatus,
  type FrameworkId,
} from "./catalog.js";

export interface EvidenceRecord {
  id: string;
  controlId: string;
  title: string;
  collectedAt: string;
  source: string;
  /** Opaque pointer — not free-form secrets */
  reference: string;
}

export interface ControlState {
  controlId: string;
  status: ControlStatus;
  owner?: string;
  evidenceIds: string[];
  exceptionReason?: string;
  approvalHistory: Array<{ by: string; at: string; action: string }>;
}

export interface ComplianceReport {
  generatedAt: string;
  framework?: FrameworkId;
  controls: Array<{
    control: ControlDefinition;
    status: ControlStatus;
    owner?: string;
    evidenceCount: number;
    complete: boolean;
  }>;
  summary: {
    total: number;
    implemented: number;
    incomplete: number;
    exceptions: number;
  };
  disclaimer: string;
  /** Metadata for signed export (signature applied by caller) */
  reportMeta: {
    version: string;
    contentFingerprint: string;
  };
}

export function buildReport(
  states: ControlState[],
  evidence: EvidenceRecord[],
  framework?: FrameworkId,
): ComplianceReport {
  const stateById = new Map(states.map((s) => [s.controlId, s]));
  const evidenceByControl = new Map<string, EvidenceRecord[]>();
  for (const e of evidence) {
    const list = evidenceByControl.get(e.controlId) ?? [];
    list.push(e);
    evidenceByControl.set(e.controlId, list);
  }

  let catalog = CONTROL_CATALOG;
  if (framework) {
    catalog = catalog.filter((c) => c.frameworks.includes(framework));
  }

  const controls = catalog.map((control) => {
    const st = stateById.get(control.id);
    const ev = evidenceByControl.get(control.id) ?? [];
    const status: ControlStatus = st?.status ?? "not_started";
    const hasEvidence = ev.length > 0 || (st?.evidenceIds.length ?? 0) > 0;
    const complete =
      status === "implemented" || status === "not_applicable"
        ? status === "not_applicable" || hasEvidence
        : false;

    // Controls without evidence cannot be "implemented"
    const effectiveStatus: ControlStatus =
      status === "implemented" && !hasEvidence ? "in_progress" : status;

    return {
      control,
      status: effectiveStatus,
      owner: st?.owner,
      evidenceCount: ev.length + (st?.evidenceIds.length ?? 0),
      complete: effectiveStatus === "implemented" || effectiveStatus === "not_applicable",
    };
  });

  const summary = {
    total: controls.length,
    implemented: controls.filter((c) => c.status === "implemented").length,
    incomplete: controls.filter((c) => c.status === "not_started" || c.status === "in_progress")
      .length,
    exceptions: controls.filter((c) => c.status === "exception").length,
  };

  const fingerprint = simpleHash(
    JSON.stringify({
      framework,
      controls: controls.map((c) => ({ id: c.control.id, status: c.status, e: c.evidenceCount })),
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    framework,
    controls,
    summary,
    disclaimer: NON_CERTIFICATION_DISCLAIMER,
    reportMeta: {
      version: "1.0",
      contentFingerprint: fingerprint,
    },
  };
}

export function exportAuditEvents(
  events: Array<{ type: string; at: string; actor?: string; detail?: unknown }>,
): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `fp_${(h >>> 0).toString(16)}`;
}
