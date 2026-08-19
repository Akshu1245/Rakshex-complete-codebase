import type { TeamGovernanceAdapter } from "../types";
import { getGovernanceCapabilities } from "../capabilities";
import { createCopilotAdapter } from "./copilot";
import { createCursorAdapter } from "./cursor";
import { createCsvImportAdapter } from "./csvImport";
import { createMonitorOnlyAdapter } from "./monitorOnly";
import { createOpenAiAdapter } from "./openai";

const adapters = new Map<string, TeamGovernanceAdapter>();

function register(adapter: TeamGovernanceAdapter) {
  adapters.set(adapter.provider, adapter);
}

register(createCopilotAdapter());
register(createCursorAdapter());
register(createOpenAiAdapter());
register(createCsvImportAdapter("anthropic"));
register(createCsvImportAdapter("claude_teams"));
register(createCsvImportAdapter("windsurf"));
register(createMonitorOnlyAdapter("azure_openai"));
register(createMonitorOnlyAdapter("bedrock"));
register(createMonitorOnlyAdapter("vertex"));
register(createMonitorOnlyAdapter("ollama"));
register(createMonitorOnlyAdapter("vllm"));
register(createMonitorOnlyAdapter("lm_studio"));
register(createMonitorOnlyAdapter("openai_compatible"));

export function getGovernanceAdapter(provider: string): TeamGovernanceAdapter | null {
  return adapters.get(provider) ?? null;
}

export function listGovernanceAdapters(): TeamGovernanceAdapter[] {
  return [...adapters.values()];
}

export function listGovernanceCapabilityCatalog() {
  return listGovernanceAdapters().map((a) => ({
    provider: a.provider,
    ...getGovernanceCapabilities(a.provider),
  }));
}
