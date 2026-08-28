import { afterEach, describe, expect, it } from "vitest";
import { createRakshexOpenAI, normalizeRakshexGatewayUrl } from "./openaiGateway.js";

type ClientOptions = {
  apiKey: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
};

class FakeOpenAI {
  readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = options;
  }
}

const originalApiKey = process.env.RAKSHEX_API_KEY;
const originalGatewayUrl = process.env.RAKSHEX_GATEWAY_URL;

afterEach(() => {
  if (originalApiKey == null) delete process.env.RAKSHEX_API_KEY;
  else process.env.RAKSHEX_API_KEY = originalApiKey;

  if (originalGatewayUrl == null) delete process.env.RAKSHEX_GATEWAY_URL;
  else process.env.RAKSHEX_GATEWAY_URL = originalGatewayUrl;
});

describe("createRakshexOpenAI", () => {
  it("uses the Rakshex workspace key and gateway instead of a provider key", () => {
    const client = createRakshexOpenAI(FakeOpenAI, {
      apiKey: "rk_workspace_test",
      gatewayUrl: "https://gateway.rakshex.test",
      agentId: "refund-agent",
      projectId: "payments",
      identityId: 42,
      providerAccountId: 7,
    });

    expect(client.options.apiKey).toBe("rk_workspace_test");
    expect(client.options.baseURL).toBe("https://gateway.rakshex.test/v1");
    expect(client.options.defaultHeaders).toMatchObject({
      "x-rakshex-provider": "openai",
      "x-rakshex-agent-id": "refund-agent",
      "x-rakshex-project-id": "payments",
      "x-rakshex-identity-id": "42",
      "x-rakshex-provider-account-id": "7",
    });
  });

  it("reads the two zero-config environment variables", () => {
    process.env.RAKSHEX_API_KEY = "rk_workspace_env";
    process.env.RAKSHEX_GATEWAY_URL = "https://gateway.rakshex.test/v1/";

    const client = createRakshexOpenAI(FakeOpenAI);

    expect(client.options.apiKey).toBe("rk_workspace_env");
    expect(client.options.baseURL).toBe("https://gateway.rakshex.test/v1");
  });

  it("preserves caller headers while forcing the OpenAI P0 provider", () => {
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
  });

  it("fails closed when the Rakshex key is missing", () => {
    delete process.env.RAKSHEX_API_KEY;
    process.env.RAKSHEX_GATEWAY_URL = "https://gateway.rakshex.test";

    expect(() => createRakshexOpenAI(FakeOpenAI)).toThrow("RAKSHEX_API_KEY is required");
  });

  it("fails closed when the gateway URL is missing", () => {
    process.env.RAKSHEX_API_KEY = "rk_workspace_test";
    delete process.env.RAKSHEX_GATEWAY_URL;

    expect(() => createRakshexOpenAI(FakeOpenAI)).toThrow("RAKSHEX_GATEWAY_URL is required");
  });

  it("encodes bounded attribution metadata and rejects oversized headers", () => {
    const client = createRakshexOpenAI(FakeOpenAI, {
      apiKey: "rk_workspace_test",
      gatewayUrl: "https://gateway.rakshex.test",
      metadata: {
        featureTags: { surface: "refunds" },
        customerTags: { team: "payments" },
      },
    });

    expect(client.options.defaultHeaders?.["x-rakshex-metadata"]).toBe(
      encodeURIComponent(
        JSON.stringify({
          featureTags: { surface: "refunds" },
          customerTags: { team: "payments" },
        }),
      ),
    );

    expect(() =>
      createRakshexOpenAI(FakeOpenAI, {
        apiKey: "rk_workspace_test",
        gatewayUrl: "https://gateway.rakshex.test",
        metadata: { customerTags: { note: "n".repeat(5000) } },
      }),
    ).toThrow("Rakshex OpenAI metadata exceeds the 4096-byte header limit");
  });
});

describe("normalizeRakshexGatewayUrl", () => {
  it("adds /v1 exactly once", () => {
    expect(normalizeRakshexGatewayUrl("https://gateway.rakshex.test")).toBe(
      "https://gateway.rakshex.test/v1",
    );
    expect(normalizeRakshexGatewayUrl("https://gateway.rakshex.test/v1/")).toBe(
      "https://gateway.rakshex.test/v1",
    );
    expect(normalizeRakshexGatewayUrl(`https://gateway.rakshex.test/v1${"/".repeat(10_000)}`)).toBe(
      "https://gateway.rakshex.test/v1",
    );
  });
});
