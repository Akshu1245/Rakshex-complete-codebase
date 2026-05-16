/**
 * DevPulse SDK — Anthropic Wrapper
 *
 * Wraps an Anthropic client instance. Intercepts messages.create,
 * captures telemetry, and forwards to DevPulse.
 */
import type { TelemetryCollector } from "../telemetry/collector.js";
import type { ChatMessage, ToolCallRecord } from "../types.js";

export function wrapAnthropic(
  client: any,
  collector: TelemetryCollector,
): any {
  if ((client as any)._devpulseWrapped) return client;

  const original = client.messages.create.bind(client.messages);

  client.messages.create = async function (params: any) {
    const start = Date.now();
    let status: "ok" | "error" | "timeout" = "ok";
    let response: any;

    try {
      response = await original(params);
    } catch (err: any) {
      status = err?.name === "AbortError" || err?.code === "ETIMEDOUT" ? "timeout" : "error";
      const latency = Date.now() - start;

      collector.buildEvent({
        provider: "anthropic",
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

    // Extract tool_use blocks from response
    for (const block of response.content || []) {
      if (block.type === "tool_use") {
        toolCalls.push({
          name: block.name || "unknown",
          args: block.input || {},
          result: undefined,
        });
      }
    }

    // Convert Anthropic messages to our format
    const messages: ChatMessage[] = ([{ role: "system", content: params.system || "" }] as ChatMessage[])
      .filter(m => m.content);
    for (const msg of params.messages || []) {
      messages.push({
        role: (msg.role || "user") as ChatMessage["role"],
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      } as ChatMessage);
    }

    const responseMessages: ChatMessage[] = [{
      role: "assistant",
      content: response.content?.map((b: any) => b.text || "").join("\n") || "",
    }];

    collector.buildEvent({
      provider: "anthropic",
      model: response.model || params.model || "unknown",
      messages,
      responseMessages,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens: (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
      latencyMs: latency,
      status,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      metadata: {
        stop_reason: response.stop_reason,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
      },
    });

    return response;
  } as any;

  (client as any)._devpulseWrapped = true;
  return client;
}
