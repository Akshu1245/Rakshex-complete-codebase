import type { ActionDomain, ActionEffect, RawActionReference, SemanticAction } from "./types";

type Definition = {
  name: string;
  domain: ActionDomain;
  effect: ActionEffect;
  aliases: RegExp[];
};

const DEFINITIONS: Definition[] = [
  { name: "financial.refund", domain: "financial", effect: "write", aliases: [/refund/i] },
  {
    name: "financial.payment.create",
    domain: "financial",
    effect: "write",
    aliases: [/payment.*create/i, /payment_intents?\.create/i, /orders?\.create/i],
  },
  {
    name: "financial.subscription.cancel",
    domain: "financial",
    effect: "destructive",
    aliases: [/subscription.*cancel/i, /subscriptions?\.delete/i],
  },
  {
    name: "code.pr.create",
    domain: "code",
    effect: "write",
    aliases: [/pulls?\.create/i, /createpullrequest/i, /pull_request.*create/i],
  },
  {
    name: "code.merge",
    domain: "code",
    effect: "destructive",
    aliases: [/pulls?\.merge/i, /mergepullrequest/i, /pull_request.*merge/i],
  },
  {
    name: "code.branch.delete",
    domain: "code",
    effect: "destructive",
    aliases: [/delete.*ref/i, /branch.*delete/i],
  },
  {
    name: "code.deploy",
    domain: "code",
    effect: "destructive",
    aliases: [/deployment.*create/i, /deploy/i],
  },
  {
    name: "database.read",
    domain: "database",
    effect: "read",
    aliases: [/^select\b/i, /^with\b[\s\S]*\bselect\b/i, /query\.read/i],
  },
  {
    name: "database.write",
    domain: "database",
    effect: "write",
    aliases: [/^(insert|update|upsert)\b/i, /query\.write/i],
  },
  {
    name: "database.delete",
    domain: "database",
    effect: "destructive",
    aliases: [/^(delete|truncate|drop)\b/i, /query\.delete/i],
  },
  {
    name: "database.schema.change",
    domain: "database",
    effect: "destructive",
    aliases: [/^(alter|create\s+(table|schema|index))\b/i, /schema.*change/i],
  },
];

const SENSITIVE_KEY = /secret|token|password|authorization|credential|cookie|api[-_]?key/i;

export function redactParameters(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactParameters);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactParameters(item),
    ]),
  );
}

function textFor(reference: RawActionReference, parameters: Record<string, unknown>): string {
  const sql = typeof parameters.sql === "string" ? parameters.sql.trim() : "";
  return [reference.provider, reference.operation, reference.toolName, sql]
    .filter(Boolean)
    .join(" ");
}

function inferMcp(reference: RawActionReference): Definition | undefined {
  const operation = `${reference.operation} ${reference.toolName ?? ""}`;
  return DEFINITIONS.find((definition) =>
    definition.aliases.some((pattern) => pattern.test(operation)),
  );
}

export function semanticActionCatalog(): Array<Pick<Definition, "name" | "domain" | "effect">> {
  return DEFINITIONS.map(({ name, domain, effect }) => ({ name, domain, effect }));
}

export function normalizeSemanticAction(input: {
  provider: string;
  operation: string;
  toolName?: string;
  requestId?: string;
  parameters?: Record<string, unknown>;
  resource?: string;
  environment?: string;
  amountMinor?: number;
  currency?: string;
}): SemanticAction {
  const raw: RawActionReference = {
    provider: input.provider.trim().toLowerCase(),
    operation: input.operation.trim(),
    requestId: input.requestId,
    toolName: input.toolName,
  };
  const parameters = (redactParameters(input.parameters ?? {}) ?? {}) as Record<string, unknown>;
  const sql = typeof input.parameters?.sql === "string" ? input.parameters.sql.trim() : "";
  const candidate =
    (raw.provider === "postgres" || raw.provider === "postgresql" || raw.provider === "database") &&
    sql
      ? sql
      : textFor(raw, input.parameters ?? {});
  const definition =
    raw.provider === "mcp" || raw.provider.startsWith("mcp:")
      ? inferMcp(raw)
      : DEFINITIONS.find((item) => item.aliases.some((pattern) => pattern.test(candidate)));

  return {
    name: definition?.name ?? "semantic.unknown",
    version: "0.1",
    domain: definition?.domain ?? "unknown",
    effect: definition?.effect ?? "unknown",
    parameters,
    resource: input.resource,
    environment: input.environment,
    amountMinor: input.amountMinor,
    currency: input.currency?.toUpperCase(),
    raw,
    known: Boolean(definition),
  };
}
