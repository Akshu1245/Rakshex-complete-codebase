/**
 * OpenAI-compatible, workspace-authenticated inline enforcement gateway.
 *
 * Surface-specific request schemas live here. All sensitive runtime behavior
 * is delegated to openAiGatewayCore so Chat Completions and Responses share
 * exactly the same auth, policy, budget, kill-switch, credential and metering
 * path.
 */
import type { Express } from "express";
import { z } from "zod";
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";
import {
  estimateGatewayPreflight,
  extractStreamingUsage,
  extractUsage,
  handleOpenAiGatewayRequest,
  isBlockedUpstreamHost,
  normalizeUpstreamUrl,
  settlementCostAfterProviderAttempt,
  type NormalizedOpenAiGatewayRequest,
  type OpenAiGatewayNormalizationResult,
} from "./openAiGatewayCore";

const chatCompletionSchema = z
  .object({
    model: z.string().min(1).max(256),
    messages: z.array(z.record(z.unknown())).min(1).max(1_000),
    stream: z.boolean().optional().default(false),
    max_tokens: z.number().int().positive().max(131_072).optional(),
    tools: z.array(z.record(z.unknown())).max(256).optional(),
    tool_choice: z.unknown().optional(),
    response_format: z.unknown().optional(),
  })
  .passthrough();

const responseInputSchema = z.union([z.string(), z.array(z.unknown()).max(1_000)]);
const responseInstructionsSchema = z.union([z.string(), z.array(z.unknown()).max(1_000)]);

const responsesSchema = z
  .object({
    // Rakshex requires an explicit model in v1 so preflight cost governance is
    // deterministic even though OpenAI can infer a model from some prompt IDs.
    model: z.string().min(1).max(256),
    input: responseInputSchema.optional(),
    instructions: responseInstructionsSchema.optional(),
    stream: z.boolean().optional().default(false),
    background: z.boolean().optional().default(false),
    max_output_tokens: z.number().int().positive().max(131_072).optional(),
    tools: z.array(z.record(z.unknown())).max(256).optional(),
    tool_choice: z.unknown().optional(),
  })
  .passthrough();

type ChatCompletionBody = z.infer<typeof chatCompletionSchema>;
type ResponsesBody = z.infer<typeof responsesSchema>;

function invalidRequest(message: string): OpenAiGatewayNormalizationResult {
  return {
    ok: false,
    status: 400,
    code: "invalid_request",
    message,
  };
}

function chatUpstreamBody(body: ChatCompletionBody): Record<string, unknown> {
  const raw = body as unknown as Record<string, unknown>;
  if (!body.stream) return raw;

  const existingStreamOptions =
    raw.stream_options && typeof raw.stream_options === "object"
      ? (raw.stream_options as Record<string, unknown>)
      : {};
  return {
    ...raw,
    stream_options: {
      ...existingStreamOptions,
      include_usage: true,
    },
  };
}

function normalizeChatCompletion(body: unknown): OpenAiGatewayNormalizationResult {
  const parsed = chatCompletionSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const value = parsed.data;
  return {
    ok: true,
    request: {
      endpoint: "chat/completions",
      model: value.model,
      stream: value.stream,
      estimatedInput: value.messages,
      maxOutputTokens: value.max_tokens,
      policyMessages: value.messages,
      policyTools: value.tools,
      upstreamBody: chatUpstreamBody(value),
    },
  };
}

function responsePolicyMessages(body: ResponsesBody): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [];

  if (typeof body.instructions === "string") {
    messages.push({ role: "system", content: body.instructions });
  } else if (Array.isArray(body.instructions)) {
    for (const item of body.instructions) {
      if (item && typeof item === "object") {
        messages.push(item as Record<string, unknown>);
      }
    }
  }

  if (typeof body.input === "string") {
    messages.push({ role: "user", content: body.input });
  } else if (Array.isArray(body.input)) {
    for (const item of body.input) {
      if (item && typeof item === "object") {
        messages.push(item as Record<string, unknown>);
      }
    }
  }

  return messages;
}

function normalizeResponses(body: unknown): OpenAiGatewayNormalizationResult {
  const parsed = responsesSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const value = parsed.data;
  if (value.background) {
    return {
      ok: false,
      status: 400,
      code: "unsupported_background",
      message:
        "Background Responses are not supported by the governed gateway yet because final usage is asynchronous",
    };
  }

  const upstreamBody = value as unknown as Record<string, unknown>;
  const request: NormalizedOpenAiGatewayRequest = {
    endpoint: "responses",
    model: value.model,
    stream: value.stream,
    estimatedInput: {
      instructions: value.instructions,
      input: value.input,
      tools: value.tools,
      prompt: upstreamBody.prompt,
    },
    maxOutputTokens: value.max_output_tokens,
    policyMessages: responsePolicyMessages(value),
    policyTools: value.tools,
    upstreamBody,
  };

  return { ok: true, request };
}

function estimateChatPreflight(body: ChatCompletionBody) {
  return estimateGatewayPreflight(body.messages, body.max_tokens);
}

export function registerOpenAiGatewayRoutes(app: Express): void {
  app.post("/v1/chat/completions", async (req, res) => {
    await handleOpenAiGatewayRequest(req, res, () => normalizeChatCompletion(req.body));
  });

  app.post("/v1/responses", async (req, res) => {
    await handleOpenAiGatewayRequest(req, res, () => normalizeResponses(req.body));
  });

  logger.info(
    { failMode: "closed", environment: ENV.nodeEnv, surfaces: ["chat/completions", "responses"] },
    "[Gateway] OpenAI-compatible enforcement routes registered",
  );
}

/** Pure helpers exposed only for focused security/correctness unit tests. */
export const __test = {
  estimatePreflight: estimateChatPreflight,
  extractUsage,
  extractStreamingUsage,
  isBlockedUpstreamHost,
  normalizeUpstreamUrl,
  normalizeChatCompletion,
  normalizeResponses,
  responsePolicyMessages,
  settlementCostAfterProviderAttempt,
};
