/** Phase 1 golden cases: explicit rule/severity/method/location assertions.
 * Scope is STATIC indicators in API specs and Postman collections, not proof of runtime exploitation.
 * Preserve these expectations before making rule changes; document any known-wrong rule separately.
 */
import { describe, expect, it } from "vitest";
import { runScan } from "./engine.js";
import { scanTextForSecrets } from "./secrets.js";

const postman = (
  method: string,
  url: string,
  headers: Array<{ key: string; value: string }> = [],
  name = "endpoint",
) => ({
  item: [{ name, request: { method, url, header: headers } }],
});
const auth = [{ key: "Authorization", value: "Bearer placeholder-not-a-real-token" }];
const openapi = (path: string, method: string, security?: Array<Record<string, string[]>>) => ({
  openapi: "3.0.3",
  paths: { [path]: { [method.toLowerCase()]: security ? { security } : {} } },
});

// 18 stable API/collection cases. `onlyRuleIds` isolates the rule being frozen.
const samples: Array<{
  name: string;
  input: unknown;
  rule: string;
  severity?: string;
  at: string;
  method: string;
}> = [
  {
    name: "Postman: HTTP",
    input: postman("GET", "http://example.test/v1/items"),
    rule: "api.insecure_http",
    severity: "High",
    at: "/v1/items",
    method: "GET",
  },
  {
    name: "Postman: HTTPS",
    input: postman("GET", "https://example.test/v1/items"),
    rule: "api.insecure_http",
    at: "/v1/items",
    method: "GET",
  },
  {
    name: "OpenAPI: unauthenticated POST",
    input: openapi("/orders", "POST"),
    rule: "api.missing_authentication",
    severity: "High",
    at: "/orders",
    method: "POST",
  },
  {
    name: "OpenAPI: secured POST",
    input: openapi("/orders", "POST", [{ bearerAuth: [] }]),
    rule: "api.missing_authentication",
    at: "/orders",
    method: "POST",
  },
  {
    name: "Postman: unauthenticated POST",
    input: postman("POST", "https://example.test/orders"),
    rule: "api.missing_authentication",
    severity: "Critical",
    at: "/orders",
    method: "POST",
  },
  {
    name: "Postman: authorized POST",
    input: postman("POST", "https://example.test/orders", auth),
    rule: "api.missing_authentication",
    at: "/orders",
    method: "POST",
  },
  {
    name: "Postman: numeric ID",
    input: postman("GET", "https://example.test/accounts/4321", auth),
    rule: "api.idor_sequential_id",
    severity: "Medium",
    at: "/accounts/4321",
    method: "GET",
  },
  {
    name: "Postman: slug path",
    input: postman("GET", "https://example.test/accounts/me", auth),
    rule: "api.idor_sequential_id",
    at: "/accounts/me",
    method: "GET",
  },
  {
    name: "Postman: password query",
    input: postman("GET", "https://example.test/login?password=FAKE", auth),
    rule: "api.sensitive_data_in_query",
    severity: "High",
    at: "/login",
    method: "GET",
  },
  {
    name: "Postman: harmless query",
    input: postman("GET", "https://example.test/login?page=2", auth),
    rule: "api.sensitive_data_in_query",
    at: "/login",
    method: "GET",
  },
  {
    name: "Postman: debug header",
    input: postman("GET", "https://example.test/status", [{ key: "X-Debug-Trace", value: "1" }]),
    rule: "api.debug_headers",
    severity: "Low",
    at: "/status",
    method: "GET",
  },
  {
    name: "Postman: accept header",
    input: postman("GET", "https://example.test/status", [
      { key: "Accept", value: "application/json" },
    ]),
    rule: "api.debug_headers",
    at: "/status",
    method: "GET",
  },
  {
    name: "Postman: missing request ID",
    input: postman("PATCH", "https://example.test/users/abc", auth),
    rule: "api.missing_correlation_id",
    severity: "Low",
    at: "/users/abc",
    method: "PATCH",
  },
  {
    name: "Postman: request ID present",
    input: postman("PATCH", "https://example.test/users/abc", [
      ...auth,
      { key: "X-Request-ID", value: "fake-id" },
    ]),
    rule: "api.missing_correlation_id",
    at: "/users/abc",
    method: "PATCH",
  },
  {
    name: "Postman: URL input indicator",
    input: postman("GET", "https://example.test/fetch?url=https%3A%2F%2Fexample.test", auth),
    rule: "api.ssrf_risk_indicator",
    severity: "Medium",
    at: "/fetch",
    method: "GET",
  },
  {
    name: "Postman: page query no SSRF",
    input: postman("GET", "https://example.test/list?page=3", auth),
    rule: "api.ssrf_risk_indicator",
    at: "/list",
    method: "GET",
  },
  {
    name: "Postman: agent shell tool",
    input: postman("POST", "https://example.test/agent/tools/invoke", auth, "agent shell exec"),
    rule: "ai.excessive_agency",
    severity: "Critical",
    at: "/agent/tools/invoke",
    method: "POST",
  },
  {
    name: "Postman: plugin output",
    input: postman("GET", "https://example.test/mcp/tool-output", auth, "plugin result"),
    rule: "ai.insecure_plugin_output",
    severity: "Medium",
    at: "/mcp/tool-output",
    method: "GET",
  },
];

describe("Phase 1 scanner golden behavior", () => {
  it.each(samples)("$name", ({ input, rule, severity, at, method }) => {
    const scan = () =>
      runScan(input, { onlyRuleIds: [rule] }).findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        method: f.method,
        endpoint: f.endpoint,
      }));
    const expected = severity ? [{ ruleId: rule, severity, method, endpoint: at }] : [];
    expect(scan()).toEqual(expected);
    expect(scan()).toEqual(scan());
  });

  it("returns zero findings for empty, invalid or non-object input without throwing", () => {
    for (const input of [null, undefined, "invalid", {}, []]) {
      expect(runScan(input).findings).toEqual([]);
    }
  });

  it("never includes fake full secret values in scan previews", () => {
    const fake = "ghp_" + "Q".repeat(36);
    const matches = scanTextForSecrets(`line one\nconst token = '${fake}';\n`, "fictional.ts");
    expect(matches).toEqual([
      expect.objectContaining({ ruleId: "secret.github_pat", severity: "Critical", line: 2 }),
    ]);
    expect(matches[0]?.preview).not.toContain(fake);
  });

  it("does not flag innocuous fake config as an embedded credential", () => {
    expect(
      scanTextForSecrets("BASE_URL=https://example.test\nTOKEN=REPLACE_ME\n", "sample.env"),
    ).toEqual([]);
  });
});
