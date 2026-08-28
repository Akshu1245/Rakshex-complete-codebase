from pathlib import Path
import re


def sub_one(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    p = Path(path)
    text = p.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{path}: regex did not match exactly once: {pattern[:120]!r}")
    p.write_text(updated)


core = "apps/api/services/gateway/openAiGatewayCore.ts"

# P0 is OpenAI-first. A workspace-controlled compatible-provider URL must not
# enter the credential-bearing fetch path until origin pinning is implemented.
sub_one(
    core,
    r'''function providerFromRequest\(req: Request\): SupportedGatewayProvider \| null \{\n.*?\n\}''',
    '''function providerFromRequest(req: Request): SupportedGatewayProvider | null {
  const provider = (req.header("x-rakshex-provider") ?? "openai").toLowerCase();
  // P0 permits only OpenAI's fixed origin. Custom compatible upstreams stay
  // fail-closed until the transport can pin and revalidate a vetted origin.
  return provider === "openai" ? "openai" : null;
}''',
    re.S,
)

sub_one(
    core,
    r'''(async function loadUpstreamConnection\([\s\S]*?\): Promise<UpstreamConnection> \{\n)''',
    r'''\1  if (provider !== "openai") {
    throw new Error("Custom OpenAI-compatible upstreams are disabled in the OpenAI P0 gateway");
  }
''',
)

sub_one(
    core,
    r'''url:\s*normalizeUpstreamUrl\(provider, account\.metadata, endpoint\),''',
    '''url: `https://api.openai.com/v1/${endpoint}`,''',
)

sub_one(
    core,
    r'''  const requestId = req\.header\("x-request-id"\)\?\.slice\(0, 128\) \|\| crypto\.randomUUID\(\);''',
    '''  // Client correlation IDs are untrusted and cannot be uniqueness keys.
  const requestId = crypto.randomUUID();''',
)

sub_one(
    core,
    r'''(  const requestedProjectId = safeScopeHeader\(req, "x-rakshex-project-id"\);)''',
    '''  // Header scopes remain attribution metadata. Enforcement scope comes only
  // from the validated API key, preventing same-tenant principal impersonation.
  const enforcementIdentityId = auth.identityId != null ? identityId : undefined;

\1''',
)
sub_one(
    core,
    r'''(  const projectId = auth\.projectId \?\? requestedProjectId;)''',
    r'''\1
  const enforcementProjectId = auth.projectId ?? undefined;''',
)
sub_one(
    core,
    r'''(  const agentId = auth\.agentId \?\? requestedAgentId;)''',
    r'''\1
  const enforcementAgentId = auth.agentId ?? undefined;''',
)

sub_one(
    core,
    r'''(const governance = await evaluateGatewayGovernance\(\{\s*workspaceId: auth\.workspaceId,\s*)identityId,\s*projectId,\s*agentId,''',
    r'''\1identityId: enforcementIdentityId,
      projectId: enforcementProjectId,
      agentId: enforcementAgentId,''',
    re.S,
)

sub_one(
    core,
    r'''agentId,\n\s*userId: effectiveIdentityId != null \? String\(effectiveIdentityId\) : undefined,''',
    '''agentId: enforcementAgentId,
          userId: enforcementIdentityId != null ? String(enforcementIdentityId) : undefined,''',
)

sub_one(
    core,
    r'''(const reservationResult = await reserveGatewayBudget\(\{\s*workspaceId: auth\.workspaceId,\s*)identityId,''',
    r'''\1identityId: enforcementIdentityId,''',
    re.S,
)

sub_one(
    core,
    r'''(cachedInputTokens: cached,\n\s*)(estimatedCostUsd: input\.estimatedCostUsd,)''',
    r'''\1usageVerified: usage != null,
    \2''',
)

sub_one(
    core,
    r'''(body: JSON\.stringify\(request\.upstreamBody\),\n\s*signal: controller\.signal,)(\n\s*\}\);)''',
    r'''\1
      // Never let a credential-bearing request follow a redirect.
      redirect: "manual",\2''',
)

attribution = "apps/api/services/gateway/gatewayAttribution.ts"
sub_one(
    attribution,
    r'''(  cachedInputTokens: number;\n)(  estimatedCostUsd: number;)''',
    r'''\1  usageVerified: boolean;
\2''',
)
sub_one(
    attribution,
    r'''input\.provider === "openai"\n\s*\? await priceModelUsage''',
    '''input.provider === "openai" && input.usageVerified
      ? await priceModelUsage''',
)

billing = "apps/api/services/billing/openAiBillingReconciliation.ts"
sub_one(
    billing,
    r'''  if \(!response\.ok\) \{\n\s*const body = \(await response\.text\(\)\)\.slice\(0, 4096\);\n\s*throw new Error\(`OpenAI admin API returned \$\{response\.status\}: \$\{body\}`\);\n\s*\}''',
    '''  if (!response.ok) {
    // Provider error bodies can contain account metadata; never echo them.
    throw new Error(`OpenAI admin API returned ${response.status}`);
  }''',
)

route_path = Path("apps/api/services/gateway/openAiProxy.route.test.ts")
route = route_path.read_text()
marker = '  it("rejects foreign identity ids before governance evaluation", async () => {'
if route.count(marker) != 1:
    raise SystemExit("route test insertion marker missing")

additions = '''  it("keeps unbound header scopes out of governance", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.resolveWorkspaceIdentityId.mockResolvedValueOnce(12);
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: false,
      killActive: true,
      budgetBlocked: false,
      budgetReason: null,
      state: { workspaceDisabled: true },
    });

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-identity-id": "12",
        "x-rakshex-project-id": "client-project",
        "x-rakshex-agent-id": "client-agent",
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(mocks.evaluateGatewayGovernance).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 42,
        identityId: undefined,
        projectId: undefined,
        agentId: undefined,
      }),
    );
  });

  it("uses server-owned request ids despite repeated client X-Request-Id", async () => {
    const handler = routeHandler();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: false,
      killActive: true,
      budgetBlocked: false,
      budgetReason: null,
      state: { workspaceDisabled: true },
    });
    const one = createResponse();
    const two = createResponse();
    const request = () =>
      createRequest("Bearer rk_live_test_workspace_key", { "x-request-id": "fixed-client-id" });

    await handler(request(), one);
    await handler(request(), two);

    const idOne = one.setHeader.mock.calls.find(([name]) => name === "x-request-id")?.[1];
    const idTwo = two.setHeader.mock.calls.find(([name]) => name === "x-request-id")?.[1];
    expect(idOne).toEqual(expect.any(String));
    expect(idTwo).toEqual(expect.any(String));
    expect(idOne).not.toBe("fixed-client-id");
    expect(idTwo).not.toBe("fixed-client-id");
    expect(idOne).not.toBe(idTwo);
  });

  it("rejects custom compatible upstreams before any provider egress", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-provider": "openai_compatible",
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

'''
route_path.write_text(route.replace(marker, additions + marker, 1))

Path("apps/api/services/gateway/gatewayAttribution.test.ts").write_text('''import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), priceModelUsage: vi.fn() }));
vi.mock("@rakshex/database", () => ({ gatewayCallAttribution: {} }));
vi.mock("../../db", () => ({ getDb: mocks.getDb }));
vi.mock("../billing/modelPriceRegistry", () => ({ priceModelUsage: mocks.priceModelUsage }));
import { persistSettledAttribution } from "./gatewayAttribution";

describe("gateway attribution settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({
      insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }),
    });
  });

  it("keeps the conservative reservation when provider usage is missing", async () => {
    mocks.priceModelUsage.mockResolvedValue({
      costUsd: 0,
      price: { id: 99, sourceUrl: "https://example.invalid/price" },
    });
    const result = await persistSettledAttribution({
      requestId: "server-id",
      workspaceId: 42,
      providerAccountId: 8,
      provider: "openai",
      model: "gpt-5",
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      usageVerified: false,
      estimatedCostUsd: 0.031,
      occurredAt: new Date("2026-08-28T00:00:00Z"),
      tags: {},
      endpoint: "responses",
    });
    expect(mocks.priceModelUsage).not.toHaveBeenCalled();
    expect(result.costUsd).toBe(0.031);
  });
});
''')
