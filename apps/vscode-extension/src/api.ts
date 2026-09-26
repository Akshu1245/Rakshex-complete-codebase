/**
 * Thin fetch wrapper around the Rakshex Agent Firewall Workers API.
 *
 * Live REST endpoints (https://rakshex-firewall.rakshex.workers.dev):
 *   GET  /v1/health                      — service health (no auth)
 *   POST /v1/evaluate                    — policy decision (Bearer API key)
 *   GET  /v1/receipts/:id                — one signed receipt entry
 *   GET  /v1/receipts/export?workspaceId — signed receipt bundle
 *   POST /v1/receipts/verify             — verify entry/bundle (body: { entry|bundle, trustedKeys })
 *
 * Methods with no Workers equivalent throw a clear "not available on the
 * hosted API yet" error — never a faked success. Callers surface err.message.
 */
import * as vscode from "vscode";
import { scanCollectionForCredentials } from "./localCollectionScan";

export const LIVE_API_ORIGIN = "https://rakshex-firewall.rakshex.workers.dev";

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type FindingStatus = "open" | "in-progress" | "resolved";

export interface DashboardData {
  collections: number;
  recentScans: number;
  totalFindings: number;
  openFindings: number;
  weeklyCost: number;
  lastScanAt: string | null;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  category: string | null;
  collectionName: string;
}

export interface Collection {
  id: string;
  name: string;
  isShared?: boolean;
}

export interface ControlPlaneSummary {
  providers: number;
  credentials: number;
  openFindings: number;
  subscriptions: number;
}

export interface ControlPlaneUsage {
  totalCostUsd: number;
  totalRequests: number;
  totalTokens: number;
  byUser: Array<{
    name: string | null;
    email: string | null;
    requests: number;
    tokens: number;
    costUsd: number;
  }>;
  byModel: Array<{
    provider: string;
    model: string;
    requests: number;
    tokens: number;
    costUsd: number;
  }>;
}

export interface ValidatedUser {
  id: number;
  email: string | null;
  name: string | null;
  plan: string;
}

export interface EvaluateActionInput {
  workspaceId: number;
  requestId: string;
  mode?: "enforce" | "shadow";
  action: {
    name: string;
    domain: "financial" | "code" | "database" | "mcp" | "unknown";
    effect: "read" | "write" | "destructive" | "unknown";
    parameters?: Record<string, unknown>;
    raw: { provider: string; operation: string; toolName?: string };
  };
}

export interface EvaluateDecision {
  decision: string;
  wouldBlock?: boolean;
  reason?: string;
  receiptId?: number;
}

export class RakshexApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RakshexApiError";
  }
}

function notAvailable(feature: string): RakshexApiError {
  return new RakshexApiError(
    `Rakshex: ${feature} is not available on the hosted API yet. Local features still work.`,
    501,
  );
}

export class RakshexApi {
  constructor(
    private readonly getBaseUrl: () => string,
    private readonly getApiKey: () => string | undefined,
  ) {}

  // --- live endpoints ----------------------------------------------------

  /** Connectivity check against the hosted API. Does not validate the key. */
  async checkHealth(): Promise<{ ok: boolean; service: string; environment?: string }> {
    return this.get<{ ok: boolean; service: string; environment?: string }>("/v1/health");
  }

  /** Policy decision for one semantic action. Auth: Bearer API key. */
  async evaluateAction(input: EvaluateActionInput): Promise<EvaluateDecision> {
    return this.post<EvaluateDecision>("/v1/evaluate", input);
  }

  /**
   * Import a Postman or OpenAPI collection.
   *
   * Local-only: the hosted API has no collections endpoint, so the file is
   * scanned on-device for exposed secrets and plaintext HTTP. Nothing is
   * uploaded and nothing is persisted server-side.
   */
  async importCollection(
    name: string,
    format: "postman" | "openapi",
    data: unknown,
  ): Promise<{
    id: string;
    name: string;
    credentialFindings?: Array<{
      ruleId: string;
      description: string;
      severity: string;
      path: string;
      matchPreview: string;
    }>;
  }> {
    const credentialFindings = scanCollectionForCredentials(data, format);
    return { id: `local-${Date.now()}`, name, credentialFindings };
  }

  /**
   * Find Postman collection files (*.postman_collection.json) in the
   * open workspace. Returns matching URIs for quick import.
   */
  async findCollectionFiles(): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(
      "**/*.postman_collection.json",
      "**/{node_modules,.git,dist,build,out,.next}/**",
      50,
    );
  }

  // --- not on the hosted API ----------------------------------------------

  async getDashboardData(): Promise<DashboardData> {
    throw notAvailable("dashboard data");
  }

  async getRecentFindings(_limit = 20): Promise<Finding[]> {
    throw notAvailable("server-side findings");
  }

  async listCollections(): Promise<Collection[]> {
    throw notAvailable("server-side collections");
  }

  async triggerScan(_collectionId: string): Promise<{ scanId: string; status: string }> {
    throw notAvailable("server-side scans (use the local workspace scan instead)");
  }

  async updateFindingStatus(
    _findingId: string,
    _status: FindingStatus,
  ): Promise<{ success: boolean }> {
    throw notAvailable("server-side finding updates");
  }

  /**
   * Telemetry is not collected by the hosted API — intentionally a no-op.
   * Kept so callers don't change; nothing is sent anywhere.
   */
  async recordActivity(
    _type:
      | "heartbeat"
      | "file_change"
      | "session_start"
      | "session_end"
      | "feedback"
      | "uninstall_feedback",
    _data: Record<string, unknown> = {},
  ): Promise<void> {
    return;
  }

  /**
   * Rotate (or mint) the current user's Rakshex API key. Returns the new
   * key in cleartext — callers should copy it to the clipboard immediately
   * and avoid logging it.
   */
  async generateApiKey(): Promise<{ apiKey: string }> {
    throw notAvailable("API key rotation");
  }

  /**
   * Ask the Rakshex Security Copilot a question. Returns the assistant's
   * response text. Falls back gracefully if the endpoint is unavailable.
   */
  async copilotAsk(_question: string, _context: string = "general"): Promise<{ response: string }> {
    throw notAvailable("Security Copilot");
  }

  async getControlPlaneSummary(_workspaceId: number): Promise<ControlPlaneSummary> {
    throw notAvailable("control-plane summary");
  }

  async getControlPlaneUsage(_workspaceId: number): Promise<ControlPlaneUsage> {
    throw notAvailable("control-plane usage");
  }

  async getControlPlaneSubscriptions(_workspaceId: number): Promise<
    Array<{
      provider: string;
      plan: string;
      seatsPurchased: number;
      seatsUsed: number;
      status: string;
    }>
  > {
    throw notAvailable("control-plane subscriptions");
  }

  // --- internals ---------------------------------------------------------

  private isOnline = true;

  getOnlineState(): boolean {
    return this.isOnline;
  }

  getConfiguredApiUrl(): string {
    return this.getBaseUrl().replace(/\/+$/, "");
  }

  getHealthUrl(): string {
    return `${this.getConfiguredApiUrl()}/v1/health`;
  }

  /**
   * Resilient fetch with timeout, retry, and offline detection.
   * Never blocks the UI — returns clear errors for callers to handle.
   */
  private async resilientFetch(
    url: string,
    init: RequestInit,
    opts: { timeoutMs?: number; retries?: number } = {},
  ): Promise<Response> {
    const timeoutMs = opts.timeoutMs ?? 10_000;
    const retries = opts.retries ?? 2;
    let lastErr: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        await new Promise((r) => setTimeout(r, delay));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timer);
        this.isOnline = true;
        return res;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (lastErr.name === "AbortError") {
          lastErr = new Error(`Request timed out after ${timeoutMs}ms`);
        }
      }
    }

    this.isOnline = false;
    throw new RakshexApiError(
      lastErr?.message ??
        "Rakshex is temporarily unreachable. Check your connection and try again.",
      0,
    );
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.resilientFetch(`${this.getConfiguredApiUrl()}${path}`, {
      method: "GET",
      headers: this.buildHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.resilientFetch(
      `${this.getConfiguredApiUrl()}${path}`,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      },
      { timeoutMs: 15_000 },
    );
    return this.handleResponse<T>(res);
  }

  private buildHeaders(apiKeyOverride?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const key = apiKeyOverride ?? this.getApiKey();
    if (key) {
      headers["x-api-key"] = key;
      headers.Authorization = `Bearer ${key}`;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const rawText = await res.text();
    let parsed: unknown = undefined;
    if (rawText.length > 0) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        /* keep parsed as undefined */
      }
    }

    if (!res.ok) {
      const errMsg =
        (parsed as { error?: string } | undefined)?.error ??
        (parsed as { message?: string } | undefined)?.message ??
        rawText ??
        res.statusText;
      throw new RakshexApiError(`Rakshex API ${res.status}: ${errMsg}`, res.status);
    }

    return parsed as T;
  }
}

/**
 * Canonical API origin. `rakshex.apiOrigin` wins; the legacy `rakshex.apiUrl`
 * setting is honored as a fallback for existing installs.
 */
export function getConfiguredBaseUrl(): string {
  const cfg = vscode.workspace.getConfiguration("rakshex");
  const origin = cfg.get<string>("apiOrigin", "").trim();
  if (origin) return origin.replace(/\/+$/, "");
  const legacy = cfg.get<string>("apiUrl", "").trim();
  if (legacy) return legacy.replace(/\/+$/, "");
  return LIVE_API_ORIGIN;
}
