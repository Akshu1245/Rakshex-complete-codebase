export type GatewayDecision = "allowed" | "blocked";

export interface GatewayRequestContext {
  provider: string;
  model: string;
  inputText?: string;
  toolNames?: string[];
  estimatedCostUsd: number;
  killSwitchActive?: boolean;
  remainingBudgetUsd?: number;
  allowedProviders?: string[];
  allowedModels?: string[];
  blockedTools?: string[];
  redactPii?: boolean;
  blockPromptInjection?: boolean;
}

export interface GatewayPolicyResult {
  decision: GatewayDecision;
  reasons: string[];
  redactedInput?: string;
  piiRedactions: number;
  promptInjectionDetected: boolean;
  estimatedCostUsd: number;
}

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
  [/\b(?:\+?\d[\d .()-]{8,}\d)\b/g, "[REDACTED_PHONE]"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /system\s+message\s*:/i,
  /reveal\s+(?:the\s+)?system\s+prompt/i,
  /disable\s+(?:your\s+)?safety|bypass\s+(?:the\s+)?policy/i,
];

export function redactPii(input: string): { value: string; count: number } {
  let value = input;
  let count = 0;
  for (const [pattern, replacement] of PII_PATTERNS) {
    value = value.replace(pattern, () => {
      count += 1;
      return replacement;
    });
  }
  return { value, count };
}

export function detectPromptInjection(input: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function estimateGatewayCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Estimates are deliberately conservative and are never presented as provider billing truth.
  const normalized = `${provider}:${model}`.toLowerCase();
  const rate =
    normalized.includes("mini") || normalized.includes("haiku")
      ? 0.0000005
      : normalized.includes("opus") || normalized.includes("pro")
        ? 0.000015
        : 0.000005;
  return Number(((inputTokens + outputTokens) * rate).toFixed(8));
}

export function evaluateGatewayRequest(context: GatewayRequestContext): GatewayPolicyResult {
  const reasons: string[] = [];
  let redactedInput = context.inputText;
  let piiRedactions = 0;
  const promptInjectionDetected = context.inputText
    ? detectPromptInjection(context.inputText)
    : false;

  if (context.killSwitchActive) reasons.push("workspace kill switch is active");
  if (context.allowedProviders && !context.allowedProviders.includes(context.provider))
    reasons.push("provider is not allowed by policy");
  if (context.allowedModels && !context.allowedModels.includes(context.model))
    reasons.push("model is not allowed by policy");
  if (
    context.remainingBudgetUsd !== undefined &&
    context.estimatedCostUsd > context.remainingBudgetUsd
  )
    reasons.push("request exceeds remaining budget");
  if (context.blockedTools?.some((tool) => context.toolNames?.includes(tool)))
    reasons.push("request contains a blocked tool");
  if (promptInjectionDetected && context.blockPromptInjection !== false)
    reasons.push("prompt injection pattern detected");
  if (context.inputText && context.redactPii !== false) {
    const result = redactPii(context.inputText);
    redactedInput = result.value;
    piiRedactions = result.count;
  }

  return {
    decision: reasons.length ? "blocked" : "allowed",
    reasons,
    redactedInput,
    piiRedactions,
    promptInjectionDetected,
    estimatedCostUsd: context.estimatedCostUsd,
  };
}
