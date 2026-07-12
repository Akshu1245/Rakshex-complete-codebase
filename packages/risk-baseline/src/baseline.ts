import type {
  BaselineComparison,
  BaselineFinding,
  GateOptions,
  RiskBaseline,
  Severity,
  SeverityCounts,
} from "./types.js";

const SEVERITY_RANK: Record<Severity, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export function countSeverities(findings: BaselineFinding[]): SeverityCounts {
  const summary: SeverityCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    total: findings.length,
  };
  for (const f of findings) {
    if (f.status === "resolved" || f.status === "suppressed") continue;
    summary[f.severity] += 1;
  }
  return summary;
}

export function createBaseline(params: {
  id: string;
  workspaceId: string;
  assetId: string;
  findings: BaselineFinding[];
  label?: string;
  createdAt?: string;
}): RiskBaseline {
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    assetId: params.assetId,
    label: params.label,
    createdAt: params.createdAt ?? new Date().toISOString(),
    findings: params.findings.map((f) => ({ ...f })),
    summary: countSeverities(params.findings),
  };
}

function isOpen(f: BaselineFinding | undefined): boolean {
  if (!f) return false;
  return !f.status || f.status === "open" || f.status === "accepted";
}

/**
 * Compare current findings against a captured baseline.
 * Pure — no I/O. Persist baselines in the API layer.
 */
export function compareToBaseline(
  baseline: RiskBaseline,
  currentFindings: BaselineFinding[],
  options: GateOptions = {},
): BaselineComparison {
  const failOn = options.failOn ?? "High";
  const failOnRegression = options.failOnRegression !== false;

  const baseMap = new Map(baseline.findings.map((f) => [f.fingerprint, f]));
  const currMap = new Map(currentFindings.map((f) => [f.fingerprint, f]));
  const allKeys = new Set([...baseMap.keys(), ...currMap.keys()]);

  const deltas: BaselineComparison["deltas"] = [];

  for (const key of allKeys) {
    const b = baseMap.get(key);
    const c = currMap.get(key);
    const bOpen = isOpen(b);
    const cOpen = isOpen(c);

    if (!b && cOpen) {
      deltas.push({ fingerprint: key, kind: "new", current: c });
      continue;
    }
    if (bOpen && !cOpen) {
      deltas.push({ fingerprint: key, kind: "resolved", baseline: b, current: c });
      continue;
    }
    if (!bOpen && cOpen) {
      deltas.push({ fingerprint: key, kind: "regressed", baseline: b, current: c });
      continue;
    }
    if (b && c && bOpen && cOpen) {
      if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[b.severity]) {
        deltas.push({
          fingerprint: key,
          kind: "severity_increased",
          baseline: b,
          current: c,
        });
      } else if (SEVERITY_RANK[c.severity] < SEVERITY_RANK[b.severity]) {
        deltas.push({
          fingerprint: key,
          kind: "severity_decreased",
          baseline: b,
          current: c,
        });
      } else {
        deltas.push({ fingerprint: key, kind: "unchanged", baseline: b, current: c });
      }
      continue;
    }
    deltas.push({ fingerprint: key, kind: "unchanged", baseline: b, current: c });
  }

  const newFindings = deltas.filter((d) => d.kind === "new");
  const resolvedFindings = deltas.filter((d) => d.kind === "resolved");
  const regressedFindings = deltas.filter((d) => d.kind === "regressed");
  const severityIncreased = deltas.filter((d) => d.kind === "severity_increased");

  const threshold = SEVERITY_RANK[failOn];
  const badNew = newFindings.some(
    (d) => d.current && SEVERITY_RANK[d.current.severity] >= threshold,
  );
  const badRegress =
    failOnRegression &&
    regressedFindings.some((d) => d.current && SEVERITY_RANK[d.current.severity] >= threshold);
  const badSeverity = severityIncreased.some(
    (d) => d.current && SEVERITY_RANK[d.current.severity] >= threshold,
  );

  return {
    baselineId: baseline.id,
    assetId: baseline.assetId,
    comparedAt: new Date().toISOString(),
    deltas,
    newFindings,
    resolvedFindings,
    regressedFindings,
    severityIncreased,
    failsGate: badNew || badRegress || badSeverity,
    summary: {
      newCount: newFindings.length,
      resolvedCount: resolvedFindings.length,
      regressedCount: regressedFindings.length,
      severityIncreasedCount: severityIncreased.length,
      unchangedCount: deltas.filter((d) => d.kind === "unchanged").length,
    },
  };
}

/** CI-friendly exit decision. */
export function shouldFailCi(comparison: BaselineComparison): boolean {
  return comparison.failsGate;
}
