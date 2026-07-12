/**
 * Agent execution graph + event log for run replay.
 * Events are append-only; the graph is derived from the log.
 */

export type AgentEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "llm.request"
  | "llm.response"
  | "tool.call"
  | "tool.result"
  | "tool.blocked"
  | "approval.requested"
  | "approval.resolved"
  | "policy.decision"
  | "kill_switch.tripped"
  | "cost.updated";

export interface AgentEvent {
  id: string;
  runId: string;
  type: AgentEventType;
  timestamp: string;
  parentEventId?: string;
  stepId?: string;
  payload: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  kind: "run" | "step" | "llm" | "tool" | "approval" | "policy" | "cost";
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "blocked" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "next" | "calls" | "spawned" | "blocked_by" | "approved_by";
}

export interface ExecutionGraph {
  runId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootNodeId: string;
}

export interface ReplayFrame {
  index: number;
  event: AgentEvent;
  /** Graph state after applying events[0..index]. */
  graph: ExecutionGraph;
}

export interface RunSummary {
  runId: string;
  status: GraphNode["status"];
  stepCount: number;
  toolCallCount: number;
  llmCallCount: number;
  blockedCount: number;
  totalCostUsd: number;
  durationMs: number | null;
}
