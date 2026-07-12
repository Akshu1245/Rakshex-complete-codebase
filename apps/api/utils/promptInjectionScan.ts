/**
 * Prompt-injection static scanner. Iterates through a Postman/OpenAPI
 * collection, detects endpoints that *look* LLM-backed (see LLM_ENDPOINT_HINTS
 * in promptInjectionPayloads.ts), and generates a finding for each known
 * injection class that the endpoint is structurally vulnerable to.
 *
 * This is *static* detection — we never send payloads over the network in
 * this scan path. Live fuzzing is a separate (opt-in) endpoint and would
 * happen against user-owned systems only.
 */

import { nanoid } from "nanoid";
import {
  INJECTION_PAYLOADS,
  looksLikeLLMEndpoint,
  type InjectionPayload,
} from "./promptInjectionPayloads";
import { safeGetPath } from "./scanning";
import { ScanBudget } from "./scanBudget";

export interface PromptInjectionFinding {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  category: string;
  remediation: string;
  cweId: string;
  // Additional metadata — not persisted on the findings table directly,
  // but surfaced to the API caller and the finding summariser.
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

/**
 * Walk the collection and flatten it into a uniform endpoint list. Handles
 * both Postman (`item[].request`) and OpenAPI (`paths[path][method]`) inputs.
 */
function flattenCollection(collectionData: any): Endpoint[] {
  const endpoints: Endpoint[] = [];

  // Postman-style
  const items: any[] = Array.isArray(collectionData?.item) ? collectionData.item : [];
  for (const item of items) {
    const rawUrl = item?.request?.url?.raw || item?.request?.url || "";
    const url = typeof rawUrl === "string" ? rawUrl : rawUrl?.raw || "";
    endpoints.push({
      url,
      method: (item?.request?.method || "GET").toUpperCase(),
      name: item?.name || "",
      description: item?.request?.description || "",
      headers: item?.request?.header || [],
    });
  }

  // OpenAPI-style. Spec lets a path-item itself be a $ref / parameters
  // object as well, so anything that isn't a record is treated as empty.
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

/**
 * For an LLM-backed endpoint, return the subset of payloads that apply. We
 * keep all payloads for now (they all apply to any LLM endpoint), but this
 * function is the hook where future heuristics (e.g. skip delimiter attacks
 * when the endpoint uses structured messages) will live.
 */
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
 * Main entry point. Returns findings + budget stats so the scan orchestrator
 * can surface "we stopped early because diminishing returns" to the user.
 *
 * @param collectionData raw collection JSON
 * @param opts.maxEndpoints  hard cap on endpoints considered (default 500)
 * @param opts.stallWindow   stop if this many consecutive endpoints produce
 *                           zero new findings (default 25)
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
  // Dedupe: one finding per (endpoint-path × payloadId) pair. Two Postman
  // items pointing at the same path shouldn't double-report.
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
        id: nanoid(),
        title: `Prompt injection risk: ${payload.name}`,
        severity: payload.severity,
        description:
          `Endpoint ${endpoint.method} ${path} appears to be LLM-backed ` +
          `and may be vulnerable to the '${payload.name}' attack class. ` +
          payload.description,
        category: `Prompt Injection (OWASP ${payload.owaspLlmId || "LLM01"})`,
        remediation: payload.recommendation,
        cweId: "CWE-20", // Improper input validation — the closest generic CWE
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
