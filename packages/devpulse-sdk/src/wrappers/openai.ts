/**
 * DevPulse SDK — OpenAI Wrapper
 *
 * Wraps an OpenAI client instance. Intercepts chat.completions.create,
 * captures telemetry, and forwards to DevPulse.
 *
 * Usage:
 *   const dp = new DevPulse({ apiKey, workspaceId });
 *   const openai = dp.wrap(new OpenAI());
 *   const response = await openai.chat.completions.create({ ... });
 */
import type { TelemetryCollector } from "../telemetry/collector.js";
import type { ToolCallRecord } from "../types.js";

export function wrapOpenAI(
  client: any,
  collector: TelemetryCollector,
): any {
  if ((client as any)._devpulseWrapped) return client;

  const original = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = async function (params: any) {
    const start = Date.now();
    let status: "ok" | "error" | "timeout" = "ok";
    let response: any;

    try {
      response = await original(params);
    } catch (err: any) {
      status = err?.name === "AbortError" || err?.code === "ETIMEDOUT" ? "timeout" : "error";
      const latency = Date.now() - start;

      collector.buildEvent({
        provider: "openai",
        model: params.model || "unknown",
        messages: params.messages || [],
        responseMessages: [],
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        latencyMs: latency,
        status,
        metadata: { error: err?.message?.slice(0, 200) },
      });

      throw err;
    }

    const latency = Date.now() - start;
    const usage = response.usage || {};
    const toolCalls: ToolCallRecord[] = [];

    if (response.choices?.[0]?.message?.tool_calls) {
      for (const tc of response.choices[0].message.tool_calls) {
        toolCalls.push({
          name: tc.function?.name || "unknown",
          args: JSON.parse(tc.function?.arguments || "{}"),
        });
      }
    }

    collector.buildEvent({
      provider: "openai",
      model: response.model || params.model || "unknown",
      messages: params.messages || [],
      responseMessages: [response.choices?.[0]?.message].filter(Boolean),
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedTokens: usage.completion_tokens_details?.reasoning_tokens || 0,
      latencyMs: latency,
      status,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      metadata: {
        finish_reason: response.choices?.[0]?.finish_reason,
        temperature: params.temperature,
        stream: params.stream || false,
      },
    });

    return response;
  } as any;

  (client as any)._devpulseWrapped = true;
  return client;
}
