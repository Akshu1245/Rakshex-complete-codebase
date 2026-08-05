import { actionAllowed } from "./authority";
import type { Decision, EvaluationInput, EvaluationResult } from "./types";

function matches(pattern: string, value: string): boolean {
  return (
    pattern === "*" ||
    (pattern.endsWith("*") ? value.startsWith(pattern.slice(0, -1)) : pattern === value)
  );
}

function hasSequence(history: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || history.length < sequence.length) return false;
  return history
    .slice(-sequence.length)
    .every((action, index) => matches(sequence[index]!, action));
}

export function evaluateAction(input: EvaluationInput): EvaluationResult {
  const reasons: string[] = [];
  let decision: Decision = "ALLOW";
  const policyVersion = input.policy?.version ?? "builtin:0.1";

  if (input.frozen) {
    decision = "FREEZE";
    reasons.push("Agent or workspace is frozen");
  } else if (!input.authority) {
    decision = "DENY";
    reasons.push("No active delegated authority was supplied");
  } else {
    const authorityReasons = actionAllowed(input.authority, input.action, input.now);
    if (authorityReasons.length) {
      decision = "DENY";
      reasons.push(...authorityReasons);
    }
  }

  if (decision === "ALLOW" && !input.action.known && input.action.effect !== "read") {
    decision = input.policy?.unknownWriteDecision ?? "DENY";
    reasons.push("Unknown write or destructive action follows the restrictive path");
  }
  if (
    decision === "ALLOW" &&
    input.policy?.denyActions?.some((pattern) => matches(pattern, input.action.name))
  ) {
    decision = "DENY";
    reasons.push("Organization policy denies this action");
  }
  if (
    decision === "ALLOW" &&
    input.policy?.approvalActions?.some((pattern) => matches(pattern, input.action.name))
  ) {
    decision = "APPROVAL_REQUIRED";
    reasons.push("Organization policy requires approval for this action");
  }
  if (
    decision === "ALLOW" &&
    input.policy?.approvalAboveMinor != null &&
    (input.action.amountMinor ?? 0) > input.policy.approvalAboveMinor
  ) {
    decision = "APPROVAL_REQUIRED";
    reasons.push("Action amount exceeds the approval threshold");
  }
  if (
    decision === "ALLOW" &&
    input.authority?.maxCount != null &&
    (input.cumulative?.actionCount ?? 0) >= input.authority.maxCount
  ) {
    decision = "LIMIT";
    reasons.push("Delegated action-count limit has been reached");
  }
  if (
    decision === "ALLOW" &&
    input.policy?.dailyAmountLimitMinor != null &&
    (input.cumulative?.amountMinor ?? 0) + (input.action.amountMinor ?? 0) >
      input.policy.dailyAmountLimitMinor
  ) {
    decision = "PAUSE";
    reasons.push("Cumulative daily amount limit would be exceeded");
  }
  if (decision === "ALLOW" && input.policy?.dangerousSequences?.length) {
    const history = [...(input.cumulative?.recentActions ?? []), input.action.name];
    if (input.policy.dangerousSequences.some((sequence) => hasSequence(history, sequence))) {
      decision = "APPROVAL_REQUIRED";
      reasons.push("Action completes a configured high-risk sequence");
    }
  }

  const passThrough = new Set<Decision>(["ALLOW", "REDACT", "SANDBOX"]).has(decision);
  const wouldBlock = !passThrough;
  const enforced = input.mode === "enforce";
  return {
    decision,
    effectiveDecision:
      input.mode === "shadow"
        ? "ALLOW"
        : passThrough
          ? "ALLOW"
          : decision === "APPROVAL_REQUIRED"
            ? "PENDING_APPROVAL"
            : "DENY",
    wouldBlock,
    enforced,
    reasons: reasons.length ? reasons : ["Action is within delegated authority and policy"],
    policyVersion,
  };
}
