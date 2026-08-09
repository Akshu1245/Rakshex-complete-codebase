import { randomId } from "./hash.js";

const DEFAULT_GATEWAY = "https://api.rakshex.in";

export interface FirewallClientOptions {
  apiKey: string;
  workspaceId: number;
  agentId: string;
  capabilityToken: string;
  gatewayUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface FirewallAction {
  provider: string;
  operation: string;
  toolName?: string;
  requestId?: string;
  parameters?: Record<string, unknown>;
  resource?: string;
  environment?: string;
  amountMinor?: number;
  currency?: string;
  projectId?: string;
  traceId?: string;
  idempotencyKey?: string;
}

export interface FirewallDecision {
  ledgerId: string;
  traceId: string;
  approvalId?: string;
  mode: "shadow" | "enforce";
  decision:
    "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "LIMIT" | "REDACT" | "SANDBOX" | "PAUSE" | "FREEZE";
  effectiveDecision: "ALLOW" | "DENY" | "PENDING_APPROVAL";
  reasons: string[];
  replayed: boolean;
  normalizedAction: { name: string; parameters: Record<string, unknown> };
}

/** Provider response relayed by the RaksHex broker. Never contains the credential. */
export interface BrokeredResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
  durationMs: number;
  egressId: string;
}

export class FirewallDeniedError extends Error {
  constructor(readonly result: FirewallDecision) {
    super(`RaksHex blocked ${result.normalizedAction.name}: ${result.reasons.join("; ")}`);
    this.name = "FirewallDeniedError";
  }
}

function resultData<T>(payload: unknown): T {
  const value = payload as {
    result?: { data?: { json?: T } | T };
    error?: { json?: { message?: string }; message?: string };
  };
  if (value.error) {
    throw new Error(value.error.json?.message ?? value.error.message ?? "RaksHex request failed");
  }
  const data = value.result?.data;
  if (!data) throw new Error("RaksHex returned an invalid response");
  return (
    typeof data === "object" && data !== null && "json" in data ? (data as { json: T }).json : data
  ) as T;
}

export class AgentFirewallClient {
  private readonly fetchImpl: typeof fetch;
  private readonly gatewayUrl: string;

  constructor(private readonly options: FirewallClientOptions) {
    if (!options.apiKey.startsWith("rk_"))
      throw new Error("A RaksHex workspace API key is required");
    if (!options.capabilityToken.startsWith("rk_cap_")) {
      throw new Error("A RaksHex agent capability token is required");
    }
    this.gatewayUrl = (options.gatewayUrl ?? DEFAULT_GATEWAY).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async mutation<T>(path: string, input: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`${this.gatewayUrl}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.options.apiKey },
      body: JSON.stringify({ json: input }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (body as { error?: { json?: { message?: string } } } | null)?.error?.json
        ?.message;
      throw new Error(message ?? `RaksHex request failed with HTTP ${response.status}`);
    }
    return resultData<T>(body);
  }

  evaluate(action: FirewallAction): Promise<FirewallDecision> {
    return this.mutation("agentFirewall.evaluate", {
      ...action,
      workspaceId: this.options.workspaceId,
      agentId: this.options.agentId,
      capabilityToken: this.options.capabilityToken,
      idempotencyKey: action.idempotencyKey ?? randomId(),
    });
  }

  async authorizeAndRun<T>(
    action: FirewallAction,
    execute: () => Promise<T>,
  ): Promise<{ decision: FirewallDecision; result: T }> {
    const decision = await this.evaluate(action);
    if (decision.effectiveDecision !== "ALLOW") throw new FirewallDeniedError(decision);
    try {
      const result = await execute();
      await this.recordOutcome(decision.ledgerId, "succeeded");
      return { decision, result };
    } catch (error) {
      await this.recordOutcome(decision.ledgerId, "failed", {
        errorType: error instanceof Error ? error.name : "Error",
      }).catch(() => undefined);
      throw error;
    }
  }

  consumeApproval(approvalId: string) {
    return this.mutation<{
      approvalId: string;
      ledgerId: string;
      semanticAction: string;
      effectiveDecision: "ALLOW";
      consumed: true;
    }>("agentFirewall.approvals.consume", {
      workspaceId: this.options.workspaceId,
      approvalId,
    });
  }

  /**
   * Authorize an action and have RaksHex make the provider call for you.
   *
   * Prefer this over `authorizeAndRun()` for anything that touches money,
   * production data, or code. With `authorizeAndRun()` your process still
   * holds the real provider key, so a DENY is only as good as your code's
   * willingness to honour it. Here the key never leaves RaksHex: you pass a
   * credential id, and the call is only made if `evaluate()` returned ALLOW.
   *
   * The authorization is single-use — one ALLOW buys exactly one call.
   */
  async executeWithCredential<T = unknown>(
    action: FirewallAction,
    request: {
      credentialId: string;
      targetUrl: string;
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
      headers?: Record<string, string>;
      body?: unknown;
    },
  ): Promise<{ decision: FirewallDecision; response: BrokeredResponse<T> }> {
    const decision = await this.evaluate(action);
    if (decision.effectiveDecision !== "ALLOW") throw new FirewallDeniedError(decision);
    const response = await this.mutation<BrokeredResponse<T>>("agentFirewall.credentials.broker", {
      workspaceId: this.options.workspaceId,
      credentialId: request.credentialId,
      ledgerId: decision.ledgerId,
      targetUrl: request.targetUrl,
      method: request.method ?? "POST",
      headers: request.headers,
      body: request.body,
    });
    await this.recordOutcome(
      decision.ledgerId,
      response.status >= 200 && response.status < 300 ? "succeeded" : "failed",
      { status: response.status },
    ).catch(() => undefined);
    return { decision, response };
  }

  recordOutcome(
    ledgerId: string,
    status: "succeeded" | "failed" | "reversed" | "not_executed",
    outcome?: Record<string, unknown>,
  ) {
    return this.mutation<{ success: true }>("agentFirewall.ledger.outcome", {
      workspaceId: this.options.workspaceId,
      ledgerId,
      status,
      outcome,
    });
  }
}

export function createAgentFirewallClient(options: FirewallClientOptions): AgentFirewallClient {
  return new AgentFirewallClient(options);
}
