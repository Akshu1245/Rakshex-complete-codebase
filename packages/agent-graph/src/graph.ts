import type { AgentEvent, ExecutionGraph, GraphEdge, GraphNode, RunSummary } from "./types.js";

function ensureRunNode(nodes: Map<string, GraphNode>, runId: string): GraphNode {
  const id = `run:${runId}`;
  let node = nodes.get(id);
  if (!node) {
    node = {
      id,
      kind: "run",
      label: `Run ${runId}`,
      status: "pending",
      metadata: {},
    };
    nodes.set(id, node);
  }
  return node;
}

/**
 * Build an execution graph from an ordered event log.
 */
export function buildExecutionGraph(runId: string, events: AgentEvent[]): ExecutionGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const runNode = ensureRunNode(nodes, runId);
  let edgeSeq = 0;
  let lastStepId: string | null = null;

  const addEdge = (from: string, to: string, kind: GraphEdge["kind"]) => {
    edges.push({ id: `e${++edgeSeq}`, from, to, kind });
  };

  for (const ev of events) {
    if (ev.runId !== runId) continue;

    switch (ev.type) {
      case "run.started":
        runNode.status = "running";
        runNode.startedAt = ev.timestamp;
        break;
      case "run.completed":
        runNode.status = "completed";
        runNode.completedAt = ev.timestamp;
        break;
      case "run.failed":
        runNode.status = "failed";
        runNode.completedAt = ev.timestamp;
        runNode.metadata.error = ev.payload.error;
        break;
      case "run.cancelled":
        runNode.status = "cancelled";
        runNode.completedAt = ev.timestamp;
        break;
      case "kill_switch.tripped":
        runNode.status = "blocked";
        runNode.metadata.killSwitch = true;
        break;
      case "step.started": {
        const stepId = String(ev.stepId ?? ev.payload.stepId ?? ev.id);
        const nodeId = `step:${stepId}`;
        nodes.set(nodeId, {
          id: nodeId,
          kind: "step",
          label: String(ev.payload.name ?? `Step ${stepId}`),
          status: "running",
          startedAt: ev.timestamp,
          metadata: { ...ev.payload },
        });
        addEdge(runNode.id, nodeId, "spawned");
        if (lastStepId) addEdge(`step:${lastStepId}`, nodeId, "next");
        lastStepId = stepId;
        break;
      }
      case "step.completed": {
        const stepId = String(ev.stepId ?? ev.payload.stepId ?? "");
        const n = nodes.get(`step:${stepId}`);
        if (n) {
          n.status = "completed";
          n.completedAt = ev.timestamp;
        }
        break;
      }
      case "step.failed": {
        const stepId = String(ev.stepId ?? ev.payload.stepId ?? "");
        const n = nodes.get(`step:${stepId}`);
        if (n) {
          n.status = "failed";
          n.completedAt = ev.timestamp;
          n.metadata.error = ev.payload.error;
        }
        break;
      }
      case "llm.request": {
        const id = `llm:${ev.id}`;
        nodes.set(id, {
          id,
          kind: "llm",
          label: String(ev.payload.model ?? "LLM"),
          status: "running",
          startedAt: ev.timestamp,
          metadata: { ...ev.payload },
        });
        const parent = ev.stepId ? `step:${ev.stepId}` : runNode.id;
        addEdge(parent, id, "calls");
        break;
      }
      case "llm.response": {
        // Attach to most recent open llm node for this step, or by parentEventId
        if (ev.parentEventId) {
          const n = nodes.get(`llm:${ev.parentEventId}`);
          if (n) {
            n.status = "completed";
            n.completedAt = ev.timestamp;
            n.metadata.response = ev.payload;
          }
        }
        break;
      }
      case "tool.call": {
        const id = `tool:${ev.id}`;
        nodes.set(id, {
          id,
          kind: "tool",
          label: String(ev.payload.toolName ?? "tool"),
          status: "running",
          startedAt: ev.timestamp,
          metadata: { ...ev.payload },
        });
        const parent = ev.stepId ? `step:${ev.stepId}` : runNode.id;
        addEdge(parent, id, "calls");
        break;
      }
      case "tool.result": {
        if (ev.parentEventId) {
          const n = nodes.get(`tool:${ev.parentEventId}`);
          if (n) {
            n.status = "completed";
            n.completedAt = ev.timestamp;
            n.metadata.result = ev.payload;
          }
        }
        break;
      }
      case "tool.blocked": {
        const id = `tool:${ev.id}`;
        nodes.set(id, {
          id,
          kind: "tool",
          label: String(ev.payload.toolName ?? "tool"),
          status: "blocked",
          startedAt: ev.timestamp,
          completedAt: ev.timestamp,
          metadata: { ...ev.payload },
        });
        const parent = ev.stepId ? `step:${ev.stepId}` : runNode.id;
        addEdge(parent, id, "blocked_by");
        break;
      }
      case "approval.requested": {
        const id = `approval:${ev.id}`;
        nodes.set(id, {
          id,
          kind: "approval",
          label: "Human approval",
          status: "pending",
          startedAt: ev.timestamp,
          metadata: { ...ev.payload },
        });
        const parent = ev.stepId ? `step:${ev.stepId}` : runNode.id;
        addEdge(parent, id, "blocked_by");
        break;
      }
      case "approval.resolved": {
        if (ev.parentEventId) {
          const n = nodes.get(`approval:${ev.parentEventId}`);
          if (n) {
            n.status = ev.payload.decision === "rejected" ? "failed" : "completed";
            n.completedAt = ev.timestamp;
            n.metadata.resolution = ev.payload;
          }
        }
        break;
      }
      case "policy.decision": {
        const id = `policy:${ev.id}`;
        nodes.set(id, {
          id,
          kind: "policy",
          label: String(ev.payload.action ?? "policy"),
          status: ev.payload.action === "deny" ? "blocked" : "completed",
          startedAt: ev.timestamp,
          completedAt: ev.timestamp,
          metadata: { ...ev.payload },
        });
        addEdge(runNode.id, id, "next");
        break;
      }
      case "cost.updated": {
        runNode.metadata.costUsd = ev.payload.costUsd;
        break;
      }
      default:
        break;
    }
  }

  return {
    runId,
    nodes: [...nodes.values()],
    edges,
    rootNodeId: runNode.id,
  };
}

export function summarizeRun(runId: string, events: AgentEvent[]): RunSummary {
  const graph = buildExecutionGraph(runId, events);
  const runNode = graph.nodes.find((n) => n.id === `run:${runId}`);
  let totalCostUsd = 0;
  for (const ev of events) {
    if (ev.type === "cost.updated" && typeof ev.payload.costUsd === "number") {
      totalCostUsd = ev.payload.costUsd;
    }
  }
  const started = runNode?.startedAt ? Date.parse(runNode.startedAt) : null;
  const ended = runNode?.completedAt ? Date.parse(runNode.completedAt) : null;

  return {
    runId,
    status: runNode?.status ?? "pending",
    stepCount: graph.nodes.filter((n) => n.kind === "step").length,
    toolCallCount: graph.nodes.filter((n) => n.kind === "tool").length,
    llmCallCount: graph.nodes.filter((n) => n.kind === "llm").length,
    blockedCount: graph.nodes.filter((n) => n.status === "blocked").length,
    totalCostUsd,
    durationMs: started != null && ended != null ? ended - started : null,
  };
}
