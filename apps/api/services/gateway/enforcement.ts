/**
 * Runtime enforcement gateway state machine.
 * Fast path: Redis. Durable: PostgreSQL via callers.
 * Supports workspace / project / agent kill switches, fail-open|closed, emergency bypass.
 */

import { evaluatePolicy, type PolicyDocument, type PolicyDecision } from "@rakshex/policy-engine";
import { evaluateGatewayRequest, type GatewayPolicyResult } from "../controlPlane/gatewayPolicy";

export type FailMode = "open" | "closed";

export interface KillSwitchState {
  workspaceDisabled: boolean;
  projectDisabled: boolean;
  agentDisabled: boolean;
  budgetLimitUsd?: number;
  currentSpendUsd?: number;
  maxTokens?: number;
  tokensUsed?: number;
  maxSteps?: number;
  maxRetries?: number;
  maxToolCalls?: number;
  allowedModels?: string[];
  allowedProviders?: string[];
  allowedTools?: string[];
  allowedDomains?: string[];
  updatedAt: string;
}

export interface EnforcementRequest {
  workspaceId: string;
  projectId?: string;
  agentId?: string;
  provider: string;
  model: string;
  toolNames?: string[];
  destination?: string;
  step?: number;
  retryCount?: number;
  toolCallCount?: number;
  estimatedCostUsd: number;
  estimatedTokens?: number;
  inputText?: string;
  /** Published policy document if any */
  policy?: PolicyDocument;
  /** Emergency bypass token present and authorized */
  emergencyBypass?: boolean;
  bypassGrantedBy?: string;
}

export interface EnforcementResult {
  allowed: boolean;
  decision: "allowed" | "blocked";
  reasons: string[];
  policyDecision?: PolicyDecision;
  gateway?: GatewayPolicyResult;
  audit: EnforcementAuditEntry;
}

export interface EnforcementAuditEntry {
  at: string;
  workspaceId: string;
  projectId?: string;
  agentId?: string;
  provider: string;
  model: string;
  decision: "allowed" | "blocked";
  reasons: string[];
  emergencyBypass: boolean;
  bypassGrantedBy?: string;
  failMode: FailMode;
}

export interface EnforcementDeps {
  /** Load kill-switch state — typically Redis with PG fallback */
  loadState: (
    workspaceId: string,
    projectId?: string,
    agentId?: string,
  ) => Promise<KillSwitchState | null>;
  failMode?: FailMode;
  /** Users allowed to set emergency bypass */
  canEmergencyBypass?: (userId: string) => boolean;
}

const DEFAULT_STATE: KillSwitchState = {
  workspaceDisabled: false,
  projectDisabled: false,
  agentDisabled: false,
  updatedAt: new Date(0).toISOString(),
};

/**
 * Pure enforcement decision given state (used by tests and gateway).
 */
export function decideEnforcement(
  req: EnforcementRequest,
  state: KillSwitchState,
  failMode: FailMode = "closed",
): EnforcementResult {
  const reasons: string[] = [];
  const at = new Date().toISOString();

  if (req.emergencyBypass) {
    const audit: EnforcementAuditEntry = {
      at,
      workspaceId: req.workspaceId,
      projectId: req.projectId,
      agentId: req.agentId,
      provider: req.provider,
      model: req.model,
      decision: "allowed",
      reasons: ["emergency bypass"],
      emergencyBypass: true,
      bypassGrantedBy: req.bypassGrantedBy,
      failMode,
    };
    return {
      allowed: true,
      decision: "allowed",
      reasons: audit.reasons,
      audit,
    };
  }

  if (state.workspaceDisabled) reasons.push("workspace kill switch is active");
  if (state.projectDisabled) reasons.push("project kill switch is active");
  if (state.agentDisabled) reasons.push("agent kill switch is active");

  if (
    state.budgetLimitUsd != null &&
    state.currentSpendUsd != null &&
    state.currentSpendUsd + req.estimatedCostUsd > state.budgetLimitUsd
  ) {
    reasons.push("budget limit would be exceeded");
  }

  if (
    state.maxTokens != null &&
    state.tokensUsed != null &&
    req.estimatedTokens != null &&
    state.tokensUsed + req.estimatedTokens > state.maxTokens
  ) {
    reasons.push("token limit would be exceeded");
  }

  if (state.maxSteps != null && req.step != null && req.step > state.maxSteps) {
    reasons.push(`step ${req.step} exceeds max_steps ${state.maxSteps}`);
  }
  if (state.maxRetries != null && req.retryCount != null && req.retryCount > state.maxRetries) {
    reasons.push(`retries exceed max_retries ${state.maxRetries}`);
  }
  if (
    state.maxToolCalls != null &&
    req.toolCallCount != null &&
    req.toolCallCount > state.maxToolCalls
  ) {
    reasons.push(`tool calls exceed max_tool_calls ${state.maxToolCalls}`);
  }

  if (state.allowedProviders?.length && !state.allowedProviders.includes(req.provider)) {
    reasons.push("provider is not on the allowlist");
  }
  if (state.allowedModels?.length && !state.allowedModels.includes(req.model)) {
    reasons.push("model is not on the allowlist");
  }
  if (state.allowedTools?.length && req.toolNames?.some((t) => !state.allowedTools!.includes(t))) {
    reasons.push("tool is not on the allowlist");
  }
  if (state.allowedDomains?.length && req.destination) {
    const host = req.destination
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0];
    if (!state.allowedDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
      reasons.push("destination domain is not on the allowlist");
    }
  }

  let policyDecision: PolicyDecision | undefined;
  if (req.policy) {
    policyDecision = evaluatePolicy(req.policy, {
      model: req.model,
      provider: req.provider,
      toolName: req.toolNames?.[0],
      destination: req.destination,
      step: req.step,
      retryCount: req.retryCount,
      costUsdSoFar: state.currentSpendUsd,
    });
    if (policyDecision.action === "deny") {
      reasons.push(...policyDecision.reasons);
    }
  }

  const remainingBudget =
    state.budgetLimitUsd != null && state.currentSpendUsd != null
      ? state.budgetLimitUsd - state.currentSpendUsd
      : undefined;

  const gateway = evaluateGatewayRequest({
    provider: req.provider,
    model: req.model,
    inputText: req.inputText,
    toolNames: req.toolNames,
    estimatedCostUsd: req.estimatedCostUsd,
    killSwitchActive: state.workspaceDisabled || state.projectDisabled || state.agentDisabled,
    remainingBudgetUsd: remainingBudget,
    allowedProviders: state.allowedProviders,
    allowedModels: state.allowedModels,
    blockedTools: undefined,
  });

  if (gateway.decision === "blocked") {
    for (const r of gateway.reasons) {
      if (!reasons.includes(r)) reasons.push(r);
    }
  }

  const blocked = reasons.length > 0;
  const audit: EnforcementAuditEntry = {
    at,
    workspaceId: req.workspaceId,
    projectId: req.projectId,
    agentId: req.agentId,
    provider: req.provider,
    model: req.model,
    decision: blocked ? "blocked" : "allowed",
    reasons,
    emergencyBypass: false,
    failMode,
  };

  return {
    allowed: !blocked,
    decision: blocked ? "blocked" : "allowed",
    reasons,
    policyDecision,
    gateway,
    audit,
  };
}

/**
 * Load state and decide. On store failure: fail-open allows, fail-closed blocks.
 */
export async function enforceRequest(
  req: EnforcementRequest,
  deps: EnforcementDeps,
): Promise<EnforcementResult> {
  const failMode = deps.failMode ?? "closed";
  try {
    const state =
      (await deps.loadState(req.workspaceId, req.projectId, req.agentId)) ?? DEFAULT_STATE;
    return decideEnforcement(req, state, failMode);
  } catch (err) {
    const reasons =
      failMode === "open"
        ? ["enforcement store unavailable — fail-open"]
        : ["enforcement store unavailable — fail-closed"];
    const allowed = failMode === "open";
    return {
      allowed,
      decision: allowed ? "allowed" : "blocked",
      reasons,
      audit: {
        at: new Date().toISOString(),
        workspaceId: req.workspaceId,
        projectId: req.projectId,
        agentId: req.agentId,
        provider: req.provider,
        model: req.model,
        decision: allowed ? "allowed" : "blocked",
        reasons,
        emergencyBypass: false,
        failMode,
      },
    };
  }
}

/** Redis key helpers for fast kill-switch propagation */
export function killSwitchRedisKey(scope: "workspace" | "project" | "agent", id: string): string {
  return `ag:kill:${scope}:${id}`;
}

export function parseKillSwitchRedis(raw: string | null): Partial<KillSwitchState> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<KillSwitchState>;
  } catch {
    return {};
  }
}

export function mergeKillSwitchState(
  workspace?: Partial<KillSwitchState>,
  project?: Partial<KillSwitchState>,
  agent?: Partial<KillSwitchState>,
): KillSwitchState {
  return {
    workspaceDisabled: Boolean(workspace?.workspaceDisabled),
    projectDisabled: Boolean(project?.projectDisabled),
    agentDisabled: Boolean(agent?.agentDisabled),
    budgetLimitUsd: workspace?.budgetLimitUsd ?? project?.budgetLimitUsd,
    currentSpendUsd: workspace?.currentSpendUsd ?? 0,
    maxTokens: workspace?.maxTokens ?? project?.maxTokens ?? agent?.maxTokens,
    tokensUsed: workspace?.tokensUsed ?? 0,
    maxSteps: agent?.maxSteps ?? project?.maxSteps ?? workspace?.maxSteps,
    maxRetries: agent?.maxRetries ?? project?.maxRetries ?? workspace?.maxRetries,
    maxToolCalls: agent?.maxToolCalls ?? project?.maxToolCalls ?? workspace?.maxToolCalls,
    allowedModels: agent?.allowedModels ?? project?.allowedModels ?? workspace?.allowedModels,
    allowedProviders:
      agent?.allowedProviders ?? project?.allowedProviders ?? workspace?.allowedProviders,
    allowedTools: agent?.allowedTools ?? project?.allowedTools ?? workspace?.allowedTools,
    allowedDomains: agent?.allowedDomains ?? project?.allowedDomains ?? workspace?.allowedDomains,
    updatedAt: new Date().toISOString(),
  };
}
