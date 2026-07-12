import { buildExecutionGraph } from "./graph.js";
import type { AgentEvent, ReplayFrame } from "./types.js";

/**
 * Produce ordered replay frames — one per event — so a UI can step through a run.
 */
export function buildReplay(runId: string, events: AgentEvent[]): ReplayFrame[] {
  const ordered = events
    .filter((e) => e.runId === runId)
    .slice()
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const frames: ReplayFrame[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const slice = ordered.slice(0, i + 1);
    frames.push({
      index: i,
      event: ordered[i]!,
      graph: buildExecutionGraph(runId, slice),
    });
  }
  return frames;
}

/** Seek to a specific frame index (clamped). */
export function seekReplay(frames: ReplayFrame[], index: number): ReplayFrame | null {
  if (frames.length === 0) return null;
  const i = Math.max(0, Math.min(index, frames.length - 1));
  return frames[i] ?? null;
}
