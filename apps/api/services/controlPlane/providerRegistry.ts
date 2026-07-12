export type ControlPlaneProvider =
  | "openai"
  | "anthropic"
  | "azure_openai"
  | "bedrock"
  | "vertex"
  | "github_copilot"
  | "claude_teams"
  | "cursor"
  | "windsurf"
  | "ollama"
  | "vllm"
  | "lm_studio"
  | "openai_compatible";

export interface ProviderCapabilities {
  connect: boolean;
  discoverAccounts: boolean;
  discoverModels: boolean;
  discoverUsage: boolean;
  discoverSubscriptions: boolean;
  validateCredential: boolean;
  revokeCredential: boolean;
  promptGateway: boolean;
  thinkingTokens: boolean;
}

export interface ProviderDefinition {
  id: ControlPlaneProvider;
  name: string;
  category: "api" | "cloud" | "developer_tool" | "self_hosted";
  capabilities: ProviderCapabilities;
  dataNotes: string;
}

const api: ProviderCapabilities = {
  connect: true,
  discoverAccounts: true,
  discoverModels: true,
  discoverUsage: true,
  discoverSubscriptions: false,
  validateCredential: true,
  revokeCredential: false,
  promptGateway: true,
  thinkingTokens: false,
};

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "api",
    capabilities: { ...api, thinkingTokens: true },
    dataNotes: "Usage depends on organization API access.",
  },
  {
    id: "anthropic",
    name: "Anthropic / Claude",
    category: "api",
    capabilities: { ...api, thinkingTokens: true },
    dataNotes: "Claude Team data requires admin-authorized access or import.",
  },
  {
    id: "azure_openai",
    name: "Azure OpenAI",
    category: "cloud",
    capabilities: { ...api, revokeCredential: true },
    dataNotes: "Usage requires Azure tenant permissions.",
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    category: "cloud",
    capabilities: { ...api },
    dataNotes: "Usage requires least-privilege AWS billing access.",
  },
  {
    id: "vertex",
    name: "Google Vertex / Gemini",
    category: "cloud",
    capabilities: { ...api },
    dataNotes: "Usage requires a Google Cloud project connection.",
  },
  {
    id: "github_copilot",
    name: "GitHub Copilot",
    category: "developer_tool",
    capabilities: { ...api, promptGateway: false, discoverSubscriptions: true },
    dataNotes:
      "Seat and plan data require GitHub organization or enterprise administration access; local prompt telemetry is not included by the provider audit log.",
  },
  {
    id: "claude_teams",
    name: "Claude Teams",
    category: "developer_tool",
    capabilities: { ...api, promptGateway: false, discoverSubscriptions: true },
    dataNotes:
      "Subscription inventory uses official admin access, SCIM/audit exports where available, or invoice import; Team access is not an API key.",
  },
  {
    id: "cursor",
    name: "Cursor",
    category: "developer_tool",
    capabilities: { ...api, promptGateway: false, discoverSubscriptions: true },
    dataNotes:
      "Cursor Admin API can expose members, usage, and spending for team administrators; connection keys are stored as admin credentials, never as end-user API keys.",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    category: "developer_tool",
    capabilities: { ...api, promptGateway: false, discoverUsage: false },
    dataNotes: "Use workspace and invoice signals when an official API is unavailable.",
  },
  {
    id: "ollama",
    name: "Ollama",
    category: "self_hosted",
    capabilities: {
      ...api,
      connect: false,
      discoverAccounts: false,
      discoverUsage: false,
      validateCredential: false,
      revokeCredential: false,
      thinkingTokens: false,
    },
    dataNotes: "Observe through the private relay or OpenTelemetry.",
  },
  {
    id: "vllm",
    name: "vLLM",
    category: "self_hosted",
    capabilities: {
      ...api,
      connect: false,
      discoverAccounts: false,
      discoverUsage: false,
      validateCredential: false,
      revokeCredential: false,
      thinkingTokens: false,
    },
    dataNotes: "Private deployment keeps prompts and credentials inside the customer network.",
  },
  {
    id: "lm_studio",
    name: "LM Studio",
    category: "self_hosted",
    capabilities: {
      ...api,
      connect: false,
      discoverAccounts: false,
      discoverUsage: false,
      validateCredential: false,
      revokeCredential: false,
      thinkingTokens: false,
    },
    dataNotes: "Observe through the private relay or OpenTelemetry.",
  },
  {
    id: "openai_compatible",
    name: "OpenAI-compatible endpoint",
    category: "api",
    capabilities: { ...api },
    dataNotes: "Customer supplies the endpoint and controls the upstream provider.",
  },
];

export function getProviderDefinition(provider: ControlPlaneProvider): ProviderDefinition {
  const definition = PROVIDERS.find((item) => item.id === provider);
  if (!definition) throw new Error(`Unsupported provider: ${provider}`);
  return definition;
}
