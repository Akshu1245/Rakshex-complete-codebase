import type { CompiledPolicy, PolicyDocument } from "./types.js";

export function compilePolicy(document: PolicyDocument): CompiledPolicy {
  const models = document.models ?? {};
  const tools = document.tools ?? {};
  const data = document.data ?? {};
  const network = document.network ?? {};

  return {
    document,
    allowedModels: models.allow?.length ? new Set(models.allow.map(normalizeModel)) : null,
    deniedModels: new Set((models.deny ?? []).map(normalizeModel)),
    deniedTools: new Set((tools.deny ?? []).map(normalizeTool)),
    approvalTools: new Set((tools.require_approval ?? []).map(normalizeTool)),
    allowedTools: tools.allow?.length ? new Set(tools.allow.map(normalizeTool)) : null,
    denyToolsByDefault: tools.deny_by_default === true,
    blockLabels: new Set((data.block ?? []).map((l) => l.toLowerCase())),
    redactLabels: new Set((data.redact ?? []).map((l) => l.toLowerCase())),
    dataAction: data.action ?? "block",
    allowDomains: network.allow_domains?.length
      ? network.allow_domains.map((d) => d.toLowerCase())
      : null,
    denyDomains: (network.deny_domains ?? []).map((d) => d.toLowerCase()),
  };
}

export function normalizeModel(model: string): string {
  return model.trim().toLowerCase();
}

export function normalizeTool(tool: string): string {
  return tool.trim().toLowerCase();
}

export function hostMatches(host: string, pattern: string): boolean {
  const h =
    host
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0] ?? host;
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) {
    const suffix = p.slice(1); // .example.com
    return h.endsWith(suffix) || h === p.slice(2);
  }
  return h === p || h.endsWith(`.${p}`);
}
