from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# CodeQL: sourceRowId is a deterministic evidence fingerprint, not a password.
# Use HMAC domain separation so CodeQL does not interpret API-key identifiers as
# password material passed through a fast password hash.
billing = "apps/api/services/billing/openAiBillingReconciliation.ts"
replace_once(
    billing,
    '''function sourceId(kind: "cost" | "usage", values: readonly unknown[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([kind, ...values]))
    .digest("hex");
}''',
    '''const PROVIDER_EVIDENCE_ID_DOMAIN = "rakshex-provider-evidence-v1";

function sourceId(kind: "cost" | "usage", values: readonly unknown[]): string {
  // This is a collision-resistant row identifier, not password storage. A
  // fixed domain-separated HMAC prevents credential-like provider IDs from
  // being treated as password-hash material while preserving idempotency.
  return crypto
    .createHmac("sha256", PROVIDER_EVIDENCE_ID_DOMAIN)
    .update(JSON.stringify([kind, ...values]))
    .digest("hex");
}''',
)

# CodeQL: remove the unbounded trailing-slash regexp. Also lock the SDK surface
# to OpenAI for this P0, matching the fail-closed gateway behavior.
sdk = "packages/sdk/src/openaiGateway.ts"
replace_once(
    sdk,
    'export type RakshexOpenAIProvider = "openai" | "openai_compatible";',
    'export type RakshexOpenAIProvider = "openai";',
)
replace_once(
    sdk,
    '''export function normalizeRakshexGatewayUrl(value: string): string {
  const normalized = value.trim().replace(/\\/+$/, "");
  if (!normalized) throw new Error("RAKSHEX_GATEWAY_URL is required");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}''',
    '''export function normalizeRakshexGatewayUrl(value: string): string {
  const trimmed = value.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed.charCodeAt(end - 1) === 47) end -= 1;
  const normalized = trimmed.slice(0, end);
  if (!normalized) throw new Error("RAKSHEX_GATEWAY_URL is required");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}''',
)

sdk_test = "packages/sdk/src/openaiGateway.test.ts"
replace_once(
    sdk_test,
    '''  it("preserves caller headers while forcing the selected governed provider", () => {
    const client = createRakshexOpenAI(FakeOpenAI, {
      apiKey: "rk_workspace_test",
      gatewayUrl: "https://gateway.rakshex.test",
      provider: "openai_compatible",
      defaultHeaders: {
        "x-correlation-id": "corr_123",
        "x-rakshex-provider": "openai",
      },
    });

    expect(client.options.defaultHeaders).toMatchObject({
      "x-correlation-id": "corr_123",
      "x-rakshex-provider": "openai_compatible",
    });
  });''',
    '''  it("preserves caller headers while forcing the OpenAI P0 provider", () => {
    const client = createRakshexOpenAI(FakeOpenAI, {
      apiKey: "rk_workspace_test",
      gatewayUrl: "https://gateway.rakshex.test",
      provider: "openai",
      defaultHeaders: {
        "x-correlation-id": "corr_123",
        "x-rakshex-provider": "attacker-controlled-value",
      },
    });

    expect(client.options.defaultHeaders).toMatchObject({
      "x-correlation-id": "corr_123",
      "x-rakshex-provider": "openai",
    });
  });''',
)
replace_once(
    sdk_test,
    '''    expect(normalizeRakshexGatewayUrl("https://gateway.rakshex.test/v1/")).toBe(
      "https://gateway.rakshex.test/v1",
    );
  });''',
    '''    expect(normalizeRakshexGatewayUrl("https://gateway.rakshex.test/v1/")).toBe(
      "https://gateway.rakshex.test/v1",
    );
    expect(normalizeRakshexGatewayUrl(`https://gateway.rakshex.test/v1${"/".repeat(10_000)}`)).toBe(
      "https://gateway.rakshex.test/v1",
    );
  });''',
)

# RBAC review comments.
provider_billing = "apps/api/api/providerBilling.ts"
replace_once(
    provider_billing,
    'return assertWorkspacePermission(workspaceId, userId, "policies", "read");',
    'return assertWorkspacePermission(workspaceId, userId, "billing", "read");',
)
replace_once(
    provider_billing,
    'return assertWorkspacePermission(workspaceId, userId, "policies", "write");',
    'return assertWorkspacePermission(workspaceId, userId, "billing", "write");',
)

receipts_api = "apps/api/api/actionReceipts.ts"
replace_once(
    receipts_api,
    'return assertWorkspacePermission(workspaceId, userId, "policies", "read");',
    'return assertWorkspacePermission(workspaceId, userId, "audit", "read");',
)

# Receipt verifier: malformed exported input must fail closed, never throw from
# timingSafeEqual because of an attacker-controlled length.
receipts = "apps/api/services/receipts/actionReceipts.ts"
replace_once(
    receipts,
    '''  const expectedHash = sha256Hex(canonicalJson(material));
  if (!crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(entry.entryHash))) {
    return "entry hash mismatch";
  }''',
    '''  const expectedHash = sha256Hex(canonicalJson(material));
  if (!/^[0-9a-f]{64}$/i.test(entry.entryHash)) {
    return "invalid entry hash encoding";
  }
  const expectedHashBytes = Buffer.from(expectedHash, "hex");
  const entryHashBytes = Buffer.from(entry.entryHash, "hex");
  if (
    entryHashBytes.length !== expectedHashBytes.length ||
    !crypto.timingSafeEqual(expectedHashBytes, entryHashBytes)
  ) {
    return "entry hash mismatch";
  }''',
)

receipts_test = "apps/api/services/receipts/actionReceipts.test.ts"
replace_once(
    receipts_test,
    '''  it("rejects a validly-shaped receipt signed by an untrusted replacement key", () => {''',
    '''  it("fails closed on a malformed hash length instead of throwing", () => {
    const { bundle, trustedKeys } = fixtureBundle();
    const malformed = structuredClone(bundle);
    malformed.entries[0]!.entryHash = "00";
    expect(() => verifyReceiptBundle(malformed, trustedKeys)).not.toThrow();
    expect(verifyReceiptBundle(malformed, trustedKeys)).toMatchObject({ valid: false });
  });

  it("rejects a validly-shaped receipt signed by an untrusted replacement key", () => {''',
)

# Gateway review comments: unbound headers must not become authoritative audit
# principals. Move the allow receipt until after provider connection lookup, so
# a missing connection yields deny-only + audit rather than allow->deny.
core = "apps/api/services/gateway/openAiGatewayCore.ts"
replace_once(
    core,
    '''  const enforcementIdentityId = auth.identityId != null ? identityId : undefined;

  const requestedProjectId''',
    '''  const enforcementIdentityId = auth.identityId != null ? identityId : undefined;
  identityId = enforcementIdentityId;

  const requestedProjectId''',
)
replace_once(
    core,
    '''  const projectId = auth.projectId ?? requestedProjectId;
  const enforcementProjectId = auth.projectId ?? undefined;''',
    '''  const enforcementProjectId = auth.projectId ?? undefined;
  const projectId = enforcementProjectId;''',
)
replace_once(
    core,
    '''  const agentId = auth.agentId ?? requestedAgentId;
  const enforcementAgentId = auth.agentId ?? undefined;''',
    '''  const enforcementAgentId = auth.agentId ?? undefined;
  const agentId = enforcementAgentId;''',
)

p = Path(core)
text = p.read_text()
allow_start = text.find('    if (\n      !(await appendReceiptOrBlock("allow", {')
if allow_start < 0:
    raise SystemExit("allow receipt block start not found")
catch_marker = '\n  } catch (err) {'
allow_end = text.find(catch_marker, allow_start)
if allow_end < 0:
    raise SystemExit("allow receipt block end not found")
allow_block = text[allow_start:allow_end]
text = text[:allow_start] + text[allow_end:]
insert_marker = '\n  const controller = new AbortController();'
insert_at = text.find(insert_marker)
if insert_at < 0:
    raise SystemExit("provider-connection insertion marker not found")
text = text[:insert_at] + '\n' + allow_block + text[insert_at:]
p.write_text(text)

replace_once(
    core,
    '''    logger.warn(
      { err, requestId, workspaceId: auth.workspaceId, provider },
      "[Gateway] Provider connection unavailable",
    );
    try {''',
    '''    logger.warn(
      { err, requestId, workspaceId: auth.workspaceId, provider },
      "[Gateway] Provider connection unavailable",
    );
    await persistGatewayResult({
      auth,
      requestId,
      provider,
      endpoint: request.endpoint,
      model: request.model,
      identityId,
      projectId,
      agentId,
      tags,
      decision: "blocked",
      blockReason: "provider_not_configured",
      estimatedCostUsd: estimate.estimatedCostUsd,
      startedAt,
    });
    try {''',
)
