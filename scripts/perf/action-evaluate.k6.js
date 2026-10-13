/**
 * Read-only authorization baseline: NO provider execution. Run only on a
 * disposable/staging database. This generates one new action-ledger decision
 * for each request and tests the workspace serialization ceiling.
 *
 * Required:
 *   RAKSHEX_PERF_STAGING_ONLY=1
 *   BASE_URL=https://your-staging-host
 *   API_KEY=rk_... (test-only)
 *   WORKSPACE_ID=... AGENT_ID=... CAPABILITY_TOKEN=rk_cap_...
 *
 * Example:
 *   k6 run -e RAKSHEX_PERF_STAGING_ONLY=1 -e BASE_URL=https://staging.example.test \
 *     -e API_KEY=rk_test -e WORKSPACE_ID=123 -e AGENT_ID=agent_test \
 *     -e CAPABILITY_TOKEN=rk_cap_test scripts/perf/action-evaluate.k6.js
 */
import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
const key = __ENV.API_KEY;
const workspaceId = Number(__ENV.WORKSPACE_ID);
const agentId = __ENV.AGENT_ID;
const capabilityToken = __ENV.CAPABILITY_TOKEN;

const safe = __ENV.RAKSHEX_PERF_STAGING_ONLY === "1" &&
  /^https?:\/\//.test(baseUrl) &&
  !/^https?:\/\/(api\.rakshex\.in|rakshex-backend\.onrender\.com)([:/]|$)/i.test(baseUrl) &&
  key && workspaceId > 0 && agentId && capabilityToken;
if (!safe) {
  throw new Error("Refusing performance requests: set staging-only guard and all test-only credentials; never target the live API");
}

const authorizedMs = new Trend("rakshex_authorize_ms", true);
const authorizationErrors = new Rate("rakshex_authorize_http_errors");

export const options = {
  discardResponseBodies: false,
  scenarios: {
    // Deliberately bounded until baseline is known. Increase cautiously in
    // explicitly disposable environments while watching lock wait and DB pool.
    workspace_baseline: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 5),
      duration: __ENV.DURATION || "30s",
      gracefulStop: "10s",
    },
  },
  tags: { workload: "action-evaluate-no-egress" },
};

export default function () {
  const randomKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const payload = {
    json: {
      workspaceId,
      agentId,
      capabilityToken,
      idempotencyKey: randomKey,
      provider: "stripe",
      operation: "refunds.create",
      resource: "perf:disposable",
      environment: "staging",
      amountMinor: 0,
      currency: "USD",
      parameters: {},
    },
  };
  const response = http.post(
    `${baseUrl}/api/trpc/agentFirewall.evaluate`,
    JSON.stringify(payload),
    {
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
      },
      tags: { endpoint: "agentFirewall.evaluate" },
      timeout: "15s",
    },
  );
  authorizedMs.add(response.timings.duration);
  authorizationErrors.add(response.status !== 200);
  check(response, {
    "authorization HTTP 200": (result) => result.status === 200,
    "authorization has decision": (result) => {
      if (result.status !== 200) return false;
      try {
        const body = JSON.parse(result.body);
        const data = body.result?.data?.json ?? body.result?.data;
        return typeof data?.decision === "string" && typeof data?.effectiveDecision === "string";
      } catch {
        return false;
      }
    },
  });
}

export function handleSummary(data) {
  const summary = {
    testedEndpoint: "agentFirewall.evaluate (no credential broker or provider call)",
    vusers: Number(__ENV.VUS || 5),
    seconds: __ENV.DURATION || "30s",
    requests: data.metrics.http_reqs?.values?.count ?? null,
    requestsPerSecond: data.metrics.http_reqs?.values?.rate ?? null,
    httpErrorRate: data.metrics.rakshex_authorize_http_errors?.values?.rate ?? null,
    latencyMs: data.metrics.rakshex_authorize_ms?.values ?? null,
  };
  return {
    stdout: JSON.stringify(summary, null, 2) + "\n",
    "action-evaluate-k6-results.json": JSON.stringify(summary, null, 2),
  };
}
