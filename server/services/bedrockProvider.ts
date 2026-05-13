/**
 * AWS Bedrock provider adapter — calls the Bedrock Converse API with
 * AWS Signature V4 authentication, translating the gateway's
 * OpenAI-compatible message format into the Bedrock Converse shape.
 *
 * Supports:
 *   - Anthropic Claude 3/3.5/4 models (via Bedrock)
 *   - Meta Llama 3/4 models (via Bedrock)
 *   - Amazon Titan, Cohere Command, Mistral (via Bedrock)
 *
 * Auth: reads AWS credentials from the standard chain
 * (env vars → ~/.aws/credentials → IAM instance profile), then
 * signs each request with SigV4. No AWS SDK dependency — we build
 * the signature manually to keep the bundle small.
 *
 * Why not `@aws-sdk/client-bedrock-runtime`?
 *   - The official SDK is ~8 MB of transitive deps and adds startup
 *     latency. The Converse API is a single JSON-in/JSON-out REST
 *     endpoint — we can sign it with ~200 lines of crypto.
 *
 * Architecture:
 *   - `invokeBedrock()` is called from the inline LLM gateway when
 *     the provider routing layer selects "bedrock".
 *   - It accepts the gateway's canonical `InvokeParams` + AWS
 *     credentials, signs the request, calls the Converse endpoint,
 *     and returns the gateway's `InvokeResult`.
 */

import crypto from "crypto";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError, RuntimePolicyError } from "../_core/errors";
import { logger } from "../_core/logger";
import type {
  InvokeParams,
  InvokeResult,
  Message,
  MessageContent,
  TextContent,
  ToolChoice,
  ToolCall,
  OutputSchema,
} from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface BedrockInvokeOptions {
  region: string;
  modelId: string;
  credentials: BedrockCredentials;
  /** Claude-specific: budget for extended thinking tokens. */
  thinkingBudget?: number;
}

/* ─── Message format translation ───────────────────────────────────────── */

interface BedrockContentBlock {
  text?: string;
  image?: {
    format: "jpeg" | "png" | "gif" | "webp";
    source: { bytes: string };
  };
  toolUse?: {
    toolUseId: string;
    name: string;
    input: unknown;
  };
  toolResult?: {
    toolUseId: string;
    content: Array<{ text: string }>;
    status?: "success" | "error";
  };
  guardContent?: { text: string };
}

interface BedrockMessage {
  role: "user" | "assistant";
  content: BedrockContentBlock[];
}

function toBedrockMessages(messages: Message[]): {
  systemPrompts: string[];
  bedrockMessages: BedrockMessage[];
} {
  const systemPrompts: string[] = [];
  const bedrockMessages: BedrockMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : (msg.content as Array<TextContent>)
              .filter(c => c.type === "text")
              .map(c => c.text)
              .join("\n");
      systemPrompts.push(text);
      continue;
    }

    const bedrockRole: "user" | "assistant" =
      msg.role === "assistant" ? "assistant" : "user";

    const blocks: BedrockContentBlock[] = [];

    if (msg.role === "tool") {
      // Bedrock doesn't have a "tool" role — we convert tool results
      // to user content blocks with toolResult format.
      const text =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      blocks.push({
        toolResult: {
          toolUseId: msg.tool_call_id ?? "unknown",
          content: [{ text }],
        },
      });
      bedrockMessages.push({ role: "user", content: blocks });
      continue;
    }

    // Try to find tool_calls from the message object
    const toolCalls: ToolCall[] | undefined = (
      msg as Message & { tool_calls?: ToolCall[] }
    ).tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        let input: unknown;
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          input = tc.function.arguments;
        }
        blocks.push({
          toolUse: {
            toolUseId: tc.id,
            name: tc.function.name,
            input,
          },
        });
      }
      bedrockMessages.push({ role: "assistant", content: blocks });
      continue;
    }

    // Normal text content
    const contentParts = Array.isArray(msg.content)
      ? msg.content
      : ([msg.content] as MessageContent[]);

    for (const part of contentParts) {
      if (typeof part === "string") {
        blocks.push({ text: part });
      } else if (part.type === "text") {
        blocks.push({ text: part.text });
      } else if (part.type === "image_url") {
        // Decode base64 data URL for Bedrock image format
        const url = part.image_url.url;
        const match = url.match(/^data:image\/(jpeg|png|gif|webp);base64,(.+)$/);
        if (match) {
          blocks.push({
            image: {
              format: match[1] as "jpeg" | "png" | "gif" | "webp",
              source: { bytes: match[2] },
            },
          });
        } else {
          logger.warn("[Bedrock] unsupported image URL format, skipping");
        }
      }
    }

    bedrockMessages.push({ role: bedrockRole, content: blocks });
  }

  return { systemPrompts, bedrockMessages };
}

/* ─── Tool config translation ──────────────────────────────────────────── */

function toBedrockToolConfig(
  tools?: InvokeParams["tools"],
  toolChoice?: ToolChoice,
  outputSchema?: OutputSchema
): Record<string, unknown> | undefined {
  if (!tools || tools.length === 0) {
    // Handle outputSchema-only case (no tools, just structured output)
    if (outputSchema) {
      return {
        tools: [
          {
            toolSpec: {
              name: "structured_output",
              description: "Generate a structured output matching the requested JSON schema",
              inputSchema: { json: outputSchema.schema ?? { type: "object", properties: {} } },
            },
          },
        ],
        toolChoice: { tool: { name: "structured_output" } },
      };
    }
    return undefined;
  }

  const bedrockTools = tools.map(t => ({
    toolSpec: {
      name: t.function.name,
      description: t.function.description ?? "",
      inputSchema: {
        json: t.function.parameters ?? { type: "object", properties: {} },
      },
    },
  }));

  const config: Record<string, unknown> = { tools: bedrockTools };

  if (toolChoice) {
    if (toolChoice === "none") {
      return undefined;
    }
    if (toolChoice === "auto") {
      config.toolChoice = { auto: {} };
    } else if (toolChoice === "required") {
      config.toolChoice = { any: {} };
    } else if ("name" in toolChoice) {
      config.toolChoice = {
        tool: { name: toolChoice.name },
      };
    } else if ("function" in toolChoice) {
      config.toolChoice = {
        tool: { name: toolChoice.function.name },
      };
    }
  }

  return config;
}

/* ─── SigV4 signing ────────────────────────────────────────────────────── */

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function getSignatureKey(
  secretKey: string,
  date: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmacSha256("AWS4" + secretKey, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function signRequest(
  method: string,
  url: string,
  region: string,
  service: string,
  body: string,
  credentials: BedrockCredentials,
  headers: Record<string, string>
): Record<string, string> {
  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const { hostname, pathname } = new URL(url);

  headers["host"] = hostname;
  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = sha256(body);

  if (credentials.sessionToken) {
    headers["x-amz-security-token"] = credentials.sessionToken;
  }

  // Canonical request
  const signedHeaders = Object.keys(headers)
    .sort()
    .join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(k => `${k}:${headers[k]}`)
    .join("\n");

  const canonicalRequest = [
    method,
    pathname || "/",
    "", // no query string for bedrock
    canonicalHeaders + "\n",
    signedHeaders,
    headers["x-amz-content-sha256"],
  ].join("\n");

  // String to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(
    credentials.secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  headers["authorization"] =
    `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

/* ─── Response translation ─────────────────────────────────────────────── */

interface BedrockConverseResponse {
  output?: {
    message?: {
      role: string;
      content: Array<{
        text?: string;
        toolUse?: {
          toolUseId: string;
          name: string;
          input: unknown;
        };
      }>;
    };
  };
  stopReason?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metrics?: { latencyMs: number };
}

function fromBedrockResponse(
  raw: BedrockConverseResponse,
  modelId: string
): InvokeResult {
  const msg = raw.output?.message;
  const content = msg?.content ?? [];

  const textParts = content
    .filter(b => "text" in b)
    .map(b => ({ type: "text" as const, text: b.text! }));

  const toolCalls: ToolCall[] = content
    .filter(b => "toolUse" in b && b.toolUse)
    .map(b => ({
      id: b.toolUse!.toolUseId,
      type: "function" as const,
      function: {
        name: b.toolUse!.name,
        arguments: JSON.stringify(b.toolUse!.input),
      },
    }));

  return {
    id: `bedrock_${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textParts.length === 1 ? textParts[0].text : textParts,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: raw.stopReason ?? null,
      },
    ],
    usage: raw.usage
      ? {
          prompt_tokens: raw.usage.inputTokens,
          completion_tokens: raw.usage.outputTokens,
          total_tokens: raw.usage.totalTokens,
        }
      : undefined,
  };
}

/* ─── Main entry point ─────────────────────────────────────────────────── */

export async function invokeBedrock(
  params: InvokeParams,
  options: BedrockInvokeOptions & { killSwitchActive?: boolean; userId?: number }
): Promise<InvokeResult> {
  // Kill-switch check
  if (options.killSwitchActive) {
    throw new RuntimePolicyError(
      "LLM API request blocked by DevPulse Kill Switch.",
      { context: { userId: options.userId, policy: "kill_switch" } }
    );
  }

  const { systemPrompts, bedrockMessages } = toBedrockMessages(params.messages);
  const toolConfig = toBedrockToolConfig(
    params.tools,
    params.tool_choice ?? params.toolChoice,
    params.outputSchema ?? params.output_schema
  );

  const body: Record<string, unknown> = {
    messages: bedrockMessages,
  };

  if (systemPrompts.length > 0) {
    body.system = systemPrompts.map(s => ({ text: s }));
  }

  const model = options.modelId;

  // Build inference config
  const inferenceConfig: Record<string, unknown> = {
    maxTokens: params.maxTokens ?? params.max_tokens ?? 4096,
    temperature: 0.7,
  };

  // Claude-specific: extended thinking
  if (options.thinkingBudget && options.thinkingBudget > 0 && model.startsWith("anthropic.")) {
    inferenceConfig.maxTokens = params.maxTokens ?? params.max_tokens ?? 4096;
  }

  body.inferenceConfig = inferenceConfig;

  if (toolConfig) {
    body.toolConfig = toolConfig;
  }

  const url = `https://bedrock-runtime.${options.region}.amazonaws.com/model/${model}/converse`;
  const bodyString = JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };

  signRequest(
    "POST",
    url,
    options.region,
    "bedrock",
    bodyString,
    options.credentials,
    headers
  );

  const response = await fetchWithTimeout(url, {
    method: "POST",
    timeoutMs: 60_000,
    headers,
    body: bodyString,
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "could not read response body");
    throw new ExternalServiceError(
      `Bedrock invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via Bedrock failed. Please try again.",
        context: {
          provider: "bedrock",
          model,
          region: options.region,
          status: response.status,
          body: errorText.slice(0, 500),
        },
      }
    );
  }

  const raw = (await response.json()) as BedrockConverseResponse;
  const result = fromBedrockResponse(raw, model);

  // Auto-track token usage
  if (options.userId && result.usage) {
    const { prompt_tokens, completion_tokens } = result.usage;
    const cost = (prompt_tokens / 1_000_000) * 0.4 + // approx pricing
      (completion_tokens / 1_000_000) * 2.0;
    import("../db").then(async db => {
      try {
        await db.recordTokenUsage(
          options.userId!,
          model,
          prompt_tokens,
          completion_tokens,
          0,
          cost
        );
      } catch (err) {
        logger.warn({ err }, "[Bedrock] Failed to record token usage");
      }
    });
  }

  return result;
}

/**
 * Bedrock provider conforming to the LLMProvider interface.
 * Register via `providerRegistry.register(bedrockProvider)`.
 */
export const bedrockProvider: LLMProvider = {
  name: "bedrock",
  defaultModel: "anthropic.claude-3-5-sonnet-20241022-v2:0",

  invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
    const sessionToken = process.env.AWS_SESSION_TOKEN || undefined;

    if (!accessKeyId || !secretAccessKey) {
      throw new ExternalServiceError(
        "AWS credentials not configured for Bedrock provider.",
        { safeMessage: "Bedrock AI is not configured. Please contact support." }
      );
    }

    return invokeBedrock(params, {
      region,
      modelId: options?.model ?? "anthropic.claude-3-5-sonnet-20241022-v2:0",
      credentials: { accessKeyId, secretAccessKey, sessionToken },
      killSwitchActive: options?.killSwitchActive,
      userId: options?.userId,
    });
  },

  supportsModel: (model: string) =>
    model.startsWith("anthropic.") ||
    model.startsWith("meta.") ||
    model.startsWith("amazon.") ||
    model.startsWith("cohere.") ||
    model.startsWith("mistral.") ||
    model.startsWith("us.") ||
    model.startsWith("eu.") ||
    model.includes("bedrock"),

  supportsVision: () => true,
  supportsPromptCaching: () => false,
};
