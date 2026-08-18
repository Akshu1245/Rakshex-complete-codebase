"use client";

interface DecisionTraceProps {
  agentName?: string;
  provider: string;
  operation: string;
  normalizedActionName?: string;
  decision: string;
  effectiveDecision: string;
  reasons: string[];
}

type StepStatus = "done" | "denied" | "pending";

function stepTone(status: StepStatus): { dot: string; line: string; text: string } {
  if (status === "denied") {
    return { dot: "bg-red-400", line: "bg-red-400/25", text: "text-red-200" };
  }
  if (status === "pending") {
    return { dot: "bg-amber-300", line: "bg-amber-300/25", text: "text-amber-200" };
  }
  return { dot: "bg-emerald-400", line: "bg-emerald-400/25", text: "text-emerald-200" };
}

function Step({
  status,
  title,
  detail,
  isLast,
}: {
  status: StepStatus;
  title: string;
  detail: string;
  isLast?: boolean;
}) {
  const tone = stepTone(status);
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
        {!isLast && <span className={`mt-1 w-px flex-1 ${tone.line}`} />}
      </div>
      <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className={`mt-0.5 text-xs leading-5 ${tone.text}`}>{detail}</p>
      </div>
    </div>
  );
}

/**
 * A step-by-step trace of one authorization decision — agent identified,
 * action normalized, authority checked, decision reached — instead of a
 * flat result box. Mirrors how the request is actually evaluated
 * (packages/action-control), so the trace order is the real pipeline
 * order, not decorative.
 */
export function DecisionTrace({
  agentName,
  provider,
  operation,
  normalizedActionName,
  decision,
  effectiveDecision,
  reasons,
}: DecisionTraceProps) {
  const denied = effectiveDecision === "DENY";
  const pending = effectiveDecision === "APPROVAL_REQUIRED";
  const finalStatus: StepStatus = denied ? "denied" : pending ? "pending" : "done";

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-white/10 bg-black/20 p-4"
    >
      <Step
        status="done"
        title="Agent identified"
        detail={agentName ? `${agentName}` : "Agent identity resolved from the capability token"}
      />
      <Step
        status="done"
        title="Action normalized"
        detail={
          normalizedActionName
            ? `${provider}.${operation} → ${normalizedActionName}`
            : `${provider}.${operation}`
        }
      />
      <Step
        status="done"
        title="Delegated authority checked"
        detail="Evaluated against the agent's active authority scope and attenuation chain"
      />
      <Step
        status={finalStatus}
        title={`Decision: ${effectiveDecision}`}
        detail={
          reasons.length > 0
            ? reasons.join(" · ")
            : decision === effectiveDecision
              ? "No overriding reasons — decision applied as evaluated"
              : `Evaluated as ${decision}, applied as ${effectiveDecision} (shadow mode)`
        }
        isLast
      />
    </div>
  );
}
