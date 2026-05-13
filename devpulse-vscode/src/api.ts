/**
 * Thin fetch wrapper around the DevPulse tRPC `vscodeExtension.*` router.
 *
 * tRPC v11 wire format:
 *   Query:    GET  /trpc/<path>?input=<urlencoded-json>
 *   Mutation: POST /trpc/<path>   body: { input: <json> }
 *
 * Responses are wrapped as `{ result: { data: <payload> } }` (tRPC serializes
 * through superjson on the server; for the shapes we consume here the JSON
 * round-trip matches the declared type without extra deserialization).
 */
import * as vscode from "vscode";

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

export interface ValidatedUser {
  id: number;
  email: string | null;
  name: string | null;
  plan: string;
}

export class DevPulseApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DevPulseApiError";
  }
}

export class DevPulseApi {
  constructor(
    private readonly getBaseUrl: () => string,
    private readonly getApiKey: () => string | undefined
  ) {}

  // --- public (no auth) --------------------------------------------------

  async validateApiKey(
    apiKey: string
  ): Promise<{ valid: boolean; user: ValidatedUser | null }> {
    return this.mutate<{ valid: boolean; user: ValidatedUser | null }>(
      "vscodeExtension.validateApiKey",
      { apiKey },
      { apiKeyOverride: apiKey }
    );
  }

  // --- protected ---------------------------------------------------------

  async getDashboardData(): Promise<DashboardData> {
    return this.query<DashboardData>("vscodeExtension.getDashboardData");
  }

  async getRecentFindings(limit = 20): Promise<Finding[]> {
    return this.query<Finding[]>("vscodeExtension.getRecentFindings", {
      limit,
    });
  }

  async listCollections(): Promise<Collection[]> {
    // `collections.list` is the canonical list endpoint on the server.
    return this.query<Collection[]>("collections.list");
  }

  async triggerScan(
    collectionId: string
  ): Promise<{ scanId: string; status: string }> {
    return this.mutate<{ scanId: string; status: string }>(
      "vscodeExtension.triggerScan",
      { collectionId }
    );
  }

  async updateFindingStatus(
    findingId: string,
    status: FindingStatus
  ): Promise<{ success: boolean }> {
    return this.mutate<{ success: boolean }>(
      "vscodeExtension.updateFindingStatus",
      { findingId, status }
    );
  }

  async recordActivity(
    type: "heartbeat" | "file_change" | "session_start" | "session_end",
    data: Record<string, unknown> = {}
  ): Promise<void> {
    await this.mutate("vscodeExtension.recordActivity", {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Rotate (or mint) the current user's DevPulse API key. Returns the new
   * key in cleartext — callers should copy it to the clipboard immediately
   * and avoid logging it.
   */
  async generateApiKey(): Promise<{ apiKey: string }> {
    return this.mutate<{ apiKey: string }>(
      "vscodeExtension.generateApiKey",
      undefined
    );
  }

  /**
   * Ask the DevPulse Security Copilot a question. Returns the assistant's
   * response text. Falls back gracefully if the endpoint is unavailable.
   */
  async copilotAsk(
    question: string,
    context: string = "general"
  ): Promise<{ response: string }> {
    return this.mutate<{ response: string }>(
      "vscodeExtension.copilotAsk",
      { question, context }
    );
  }

  // --- internals ---------------------------------------------------------

  private async query<T>(path: string, input?: unknown): Promise<T> {
    const url = new URL(`${this.trpcBase()}/${path}`);
    if (input !== undefined) {
      url.searchParams.set("input", JSON.stringify(input));
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.buildHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  /**
   * Import a Postman or OpenAPI collection into DevPulse.
   * Reads file from the workspace, sends it to the server for
   * credential scanning + persistence.
   */
  async importCollection(
    name: string,
    format: "postman" | "openapi",
    data: unknown
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
    return this.mutate("collections.create", { name, format, data });
  }

  /**
   * Find Postman collection files (*.postman_collection.json) in the
   * open workspace. Returns matching URIs for quick import.
   */
  async findCollectionFiles(): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(
      "**/*.postman_collection.json",
      "**/{node_modules,.git,dist,build,out,.next}/**",
      50
    );
  }

  private async mutate<T>(
    path: string,
    input: unknown,
    opts: { apiKeyOverride?: string } = {}
  ): Promise<T> {
    const url = `${this.trpcBase()}/${path}`;
    const body = input === undefined ? {} : { input };
    const res = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(opts.apiKeyOverride),
      body: JSON.stringify(body),
    });
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

  private trpcBase(): string {
    const base = this.getBaseUrl().replace(/\/+$/, "");
    return `${base}/trpc`;
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
        (parsed as { error?: { message?: string } } | undefined)?.error
          ?.message ??
        (parsed as { message?: string } | undefined)?.message ??
        rawText ??
        res.statusText;
      throw new DevPulseApiError(
        `DevPulse API ${res.status}: ${errMsg}`,
        res.status
      );
    }

    const payload = parsed as
      | { result?: { data?: unknown } }
      | { result?: { data?: { json?: unknown } } }
      | undefined;

    const data = payload?.result?.data;
    // Server uses superjson; outputs we consume here are plain JSON in the
    // common path, but accept the `{ json: ... }` shape as a fallback.
    if (
      data &&
      typeof data === "object" &&
      "json" in (data as Record<string, unknown>)
    ) {
      return (data as { json: T }).json;
    }
    return data as T;
  }
}

export function getConfiguredBaseUrl(): string {
  return vscode.workspace
    .getConfiguration("devpulse")
    .get<string>("apiUrl", "https://api.devpulse.in");
}
