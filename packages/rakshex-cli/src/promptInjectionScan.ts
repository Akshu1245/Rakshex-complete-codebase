/**
 * Prompt-injection static scanner. Iterates through a Postman/OpenAPI
 * collection, detects endpoints that *look* LLM-backed (see LLM_ENDPOINT_HINTS
 * in promptInjectionPayloads.ts), and generates a finding for each known
 * injection class that the endpoint is structurally vulnerable to.
 */

import crypto from "crypto";
import {
  INJECTION_PAYLOADS,
  looksLikeLLMEndpoint,
  type InjectionPayload,
} from "./promptInjectionPayloads.js";

export interface PromptInjectionFinding {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  category: string;
  remediation: string;
  cweId: string;
  endpoint: string;
  method: string;
  payloadId: string;
}

interface Endpoint {
  url: string;
  method: string;
  name: string;
  description: string;
  headers: Array<{ key: string; value: string }>;
}

/* --- Inlined scanBudget.ts --- */
export type StopReason = "max_iterations_reached" | "diminishing_returns" | "hard_timeout" | null;

export interface ScanBudgetOptions {
  maxIterations: number;
  stallWindow: number;
  hardTimeoutMs?: number;
}

export class ScanBudget {
  private opts: ScanBudgetOptions;
  private startedAt: number;
  private consecutiveEmpty = 0;
  public iterationsRun = 0;
  public totalNewItems = 0;
  public stopped = false;
  public stopReason: StopReason = null;

  constructor(opts: ScanBudgetOptions) {
    this.opts = opts;
    this.startedAt = Date.now();
  }

  shouldContinue(): boolean {
    if (this.stopped) return false;

    if (this.iterationsRun >= this.opts.maxIterations) {
      this.stopped = true;
      this.stopReason = "max_iterations_reached";
      return false;
    }

    if (this.consecutiveEmpty >= this.opts.stallWindow) {
      this.stopped = true;
      this.stopReason = "diminishing_returns";
      return false;
    }

    if (
      this.opts.hardTimeoutMs !== undefined &&
      Date.now() - this.startedAt >= this.opts.hardTimeoutMs
    ) {
      this.stopped = true;
      this.stopReason = "hard_timeout";
      return false;
    }

    return true;
  }

  recordIteration(newItemCount: number): void {
    this.iterationsRun++;
    this.totalNewItems += newItemCount;
    if (newItemCount > 0) {
      this.consecutiveEmpty = 0;
    } else {
      this.consecutiveEmpty++;
    }
  }

  summary() {
    return {
      iterationsRun: this.iterationsRun,
      totalNewItems: this.totalNewItems,
      elapsedMs: Date.now() - this.startedAt,
      stopped: this.stopped,
      stopReason: this.stopReason,
    };
  }
}

/* --- Inlined safeGetPath --- */
function safeGetPath(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const fullUrl = rawUrl.startsWith("http")
      ? rawUrl
      : "https://example.com" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl);
    return new URL(fullUrl).pathname;
  } catch {
    return null;
  }
}

function extractPostmanEndpoints(items: any[]): Endpoint[] {
  const endpoints: Endpoint[] = [];
  for (const item of items) {
    if (!item) continue;
    if (item.request) {
      const rawUrl = item.request.url?.raw || item.request.url || "";
      const url = typeof rawUrl === "string" ? rawUrl : rawUrl?.raw || "";
      endpoints.push({
        url,
        method: (item.request.method || "GET").toUpperCase(),
        name: item.name || "",
        description: item.request.description || "",
        headers: item.request.header || [],
      });
    }
    if (Array.isArray(item.item)) {
      endpoints.push(...extractPostmanEndpoints(item.item));
    }
  }
  return endpoints;
}

/**
 * Walk the collection and flatten it into a uniform endpoint list. Handles
 * both Postman (`item[].request`) and OpenAPI (`paths[path][method]`) inputs.
 */
export function flattenCollection(collectionData: any): Endpoint[] {
  const endpoints: Endpoint[] = [];

  // Postman-style
  if (Array.isArray(collectionData?.item)) {
    endpoints.push(...extractPostmanEndpoints(collectionData.item));
  }

  // OpenAPI-style
  type OpenApiOperation = {
    operationId?: string;
    summary?: string;
    description?: string;
  };
  const paths = collectionData?.paths || {};
  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem =
      rawPathItem && typeof rawPathItem === "object"
        ? (rawPathItem as Record<string, unknown>)
        : {};
    for (const [method, rawOp] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;
      const operation: OpenApiOperation =
        rawOp && typeof rawOp === "object" ? (rawOp as OpenApiOperation) : {};
      endpoints.push({
        url: path,
        method: method.toUpperCase(),
        name: operation.operationId || operation.summary || "",
        description: operation.description || "",
        headers: [],
      });
    }
  }

  return endpoints;
}

function applicablePayloads(_endpoint: Endpoint): InjectionPayload[] {
  return INJECTION_PAYLOADS;
}

export interface PromptInjectionScanResult {
  findings: PromptInjectionFinding[];
  totalEndpointsExamined: number;
  totalLLMEndpoints: number;
  budget: {
    stopped: boolean;
    iterationsRun: number;
    reason?: string;
  };
}

/**
 * Main entry point.
 */
export function generatePromptInjectionFindings(
  collectionData: any,
  opts: { maxEndpoints?: number; stallWindow?: number } = {},
): PromptInjectionScanResult {
  const maxEndpoints = opts.maxEndpoints ?? 500;
  const stallWindow = opts.stallWindow ?? 25;

  const endpoints = flattenCollection(collectionData);
  const budget = new ScanBudget({
    maxIterations: maxEndpoints,
    stallWindow,
  });

  const findings: PromptInjectionFinding[] = [];
  const seen = new Set<string>();
  let llmEndpointCount = 0;

  for (const endpoint of endpoints) {
    if (!budget.shouldContinue()) break;

    const path = safeGetPath(endpoint.url) || endpoint.url;
    const isLLM = looksLikeLLMEndpoint(endpoint.url, endpoint.name, endpoint.description);

    if (!isLLM) {
      budget.recordIteration(0);
      continue;
    }

    llmEndpointCount++;
    let newForThisEndpoint = 0;
    const payloads = applicablePayloads(endpoint);

    for (const payload of payloads) {
      const key = `${endpoint.method}:${path}:${payload.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        id: crypto.randomUUID(),
        title: `Prompt injection risk: ${payload.name}`,
        severity: payload.severity,
        description:
          `Endpoint ${endpoint.method} ${path} appears to be LLM-backed ` +
          `and may be vulnerable to the '${payload.name}' attack class. ` +
          payload.description,
        category: `Prompt Injection (OWASP ${payload.owaspLlmId || "LLM01"})`,
        remediation: payload.recommendation,
        cweId: "CWE-20",
        endpoint: path,
        method: endpoint.method,
        payloadId: payload.id,
      });
      newForThisEndpoint++;
    }

    budget.recordIteration(newForThisEndpoint);
  }

  return {
    findings,
    totalEndpointsExamined: budget.iterationsRun,
    totalLLMEndpoints: llmEndpointCount,
    budget: {
      stopped: budget.stopped,
      iterationsRun: budget.iterationsRun,
      reason: budget.stopReason ?? undefined,
    },
  };
}
