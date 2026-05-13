/**
 * Auto-fix engine.
 *
 * Generates **deterministic, templated** remediation snippets for known
 * finding types. We do not use an LLM to write patches — the snippets are
 * authored by hand, reviewed, and shipped as code. This avoids the
 * "the auto-fixer wrote an exfil payload into the patch" failure mode that
 * generative remediation tools frequently hit.
 *
 * Each finding type maps to a small set of language-specific snippets. The
 * caller selects the language hint from the source repo or finding metadata.
 */

import { recordAutofix } from "../db";

export type AutofixFindingType =
  | "missing_pii_redaction"
  | "missing_kill_switch"
  | "missing_token_budget"
  | "prompt_injection_unsanitized"
  | "shadow_ai_call"
  | "exposed_secret"
  | "missing_audit_log"
  | "rate_limit_missing";

export interface AutofixSpec {
  findingType: AutofixFindingType;
  /**
   * Optional ref so the dashboard can link the suggestion back to its
   * source finding (e.g. "scan-123/issue-7").
   */
  findingRef?: string;
  language: "node" | "python" | "go" | "generic";
  /** Free-form context; injected as comment in the generated snippet. */
  context?: string;
}

interface SnippetTemplate {
  title: string;
  rationale: string;
  byLanguage: Partial<Record<AutofixSpec["language"], string>>;
}

const TEMPLATES: Record<AutofixFindingType, SnippetTemplate> = {
  missing_pii_redaction: {
    title: "Route LLM calls through DevPulse Gateway to redact PII",
    rationale:
      "Direct LLM calls leak emails, Aadhaar/PAN numbers, AWS keys, etc. The DevPulse gateway redacts 12 PII classes before the request reaches the model.",
    byLanguage: {
      node: `// Replace direct OpenAI client init with the gateway wrapper.
import OpenAI from "openai";
import { withDevPulse } from "@devpulse/sdk";

const openai = withDevPulse(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  {
    gatewayUrl: process.env.DEVPULSE_GATEWAY_URL!,
    apiKey: process.env.DEVPULSE_API_KEY!,
    metadata: { tenantId: process.env.TENANT_ID },
  }
);
`,
      python: `# Replace direct OpenAI client init with the gateway wrapper.
import os
from openai import OpenAI
from devpulse import with_devpulse

openai_client = with_devpulse(
    OpenAI(api_key=os.environ["OPENAI_API_KEY"]),
    gateway_url=os.environ["DEVPULSE_GATEWAY_URL"],
    api_key=os.environ["DEVPULSE_API_KEY"],
    metadata={"tenantId": os.environ.get("TENANT_ID")},
)
`,
    },
  },
  missing_kill_switch: {
    title: "Add a kill-switch check before invoking the LLM",
    rationale:
      "When a runaway agent or compromised key is detected, the kill switch must halt LLM calls within seconds. The DevPulse gateway enforces this server-side; if you call the provider directly, you lose this guarantee.",
    byLanguage: {
      node: `// At app boot:
import { ensureGatewayHealthy } from "@devpulse/sdk";
await ensureGatewayHealthy(process.env.DEVPULSE_GATEWAY_URL!);
// Then route every chat completion through the gateway client.
`,
      python: `# At app boot:
from devpulse import ensure_gateway_healthy
ensure_gateway_healthy(os.environ["DEVPULSE_GATEWAY_URL"])
# Then route every chat completion through the gateway client.
`,
    },
  },
  missing_token_budget: {
    title: "Configure per-tenant daily token budgets",
    rationale:
      "Without a hard cap, a single buggy loop can burn a month of budget overnight. Configure a daily token cap in the DevPulse dashboard and set mode='hard' for production tenants.",
    byLanguage: {
      generic: `// In the DevPulse dashboard:
//   Settings → Billing → Token Budgets
//   - Pro tier:        500,000 tokens/day  (mode: soft)
//   - Business tier:   5,000,000 tokens/day (mode: soft)
//   - Production:      hard cap matched to your model spend ceiling
`,
    },
  },
  prompt_injection_unsanitized: {
    title: "Validate user-supplied content before sending to the LLM",
    rationale:
      "If user input is concatenated directly into a prompt, attackers can override your system instructions. The DevPulse gateway runs an 87-payload classifier on every request; if you can't route through the gateway, mirror the same checks locally.",
    byLanguage: {
      node: `import { detectInjection } from "@devpulse/sdk/detectors";

const userInput = req.body.message;
const verdict = detectInjection(userInput);
if (verdict.severity === "Critical" || verdict.severity === "High") {
  return res.status(422).json({
    error: "prompt_blocked",
    reason: verdict.payloadId,
  });
}
`,
      python: `from devpulse.detectors import detect_injection

verdict = detect_injection(user_input)
if verdict.severity in ("Critical", "High"):
    raise HTTPException(status_code=422, detail={"error": "prompt_blocked"})
`,
    },
  },
  shadow_ai_call: {
    title: "Replace direct provider calls with DevPulse gateway calls",
    rationale:
      "Direct calls to api.openai.com / api.anthropic.com bypass kill-switch, PII redaction, and budget enforcement. Centralize through the gateway and add the source endpoint to your allowlist if needed.",
    byLanguage: {
      node: `- const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
+ import { withDevPulse } from "@devpulse/sdk";
+ const openai = withDevPulse(
+   new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
+   {
+     gatewayUrl: process.env.DEVPULSE_GATEWAY_URL!,
+     apiKey: process.env.DEVPULSE_API_KEY!,
+   }
+ );
`,
    },
  },
  exposed_secret: {
    title: "Move the secret out of the repo and rotate it",
    rationale:
      "An API key, JWT, or AWS access key was committed to source control. Rotate the secret immediately and load it from a secret manager.",
    byLanguage: {
      generic: `// 1. Rotate the secret in the provider dashboard NOW.
// 2. Remove the secret from git history (BFG or git-filter-repo).
// 3. Load from environment variable injected by your secret manager:
//      const apiKey = process.env.OPENAI_API_KEY!;
// 4. Re-deploy. Audit access logs for usage of the leaked key.
`,
    },
  },
  missing_audit_log: {
    title: "Emit a structured audit event on every LLM call",
    rationale:
      "Auditors and SOC2 reviewers need a per-request log with tenantId, model, token counts, and policy decision. The gateway emits these automatically; if you bypass the gateway, log them yourself.",
    byLanguage: {
      node: `import { logger } from "./_core/logger";

logger.info(
  {
    tenantId,
    model: "gpt-4o",
    requestId,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    decision: "allowed",
  },
  "llm.audit"
);
`,
    },
  },
  rate_limit_missing: {
    title: "Add a per-tenant rate limit on the LLM endpoint",
    rationale:
      "Without a per-tenant rate limit, a single tenant can starve the rest of the platform of model capacity. Use the DevPulse gateway's built-in limiter or add an Express-rate-limit middleware.",
    byLanguage: {
      node: `import rateLimit from "express-rate-limit";

const llmLimiter = rateLimit({
  windowMs: 60_000,
  max: 60, // requests per minute per tenant
  keyGenerator: req => String(req.headers["x-devpulse-tenant"] ?? "anon"),
});

app.post("/api/llm", llmLimiter, /* … */);
`,
    },
  },
};

export interface AutofixResult {
  title: string;
  rationale: string;
  languageHint: string;
  snippet: string;
}

export function generateAutofix(spec: AutofixSpec): AutofixResult {
  const tpl = TEMPLATES[spec.findingType];
  if (!tpl) {
    throw new Error(`Unknown findingType: ${spec.findingType}`);
  }
  const snippet =
    tpl.byLanguage[spec.language] ??
    tpl.byLanguage.node ??
    tpl.byLanguage.python ??
    tpl.byLanguage.generic ??
    "// no template available for this language yet";
  const annotated = spec.context
    ? `// Context: ${spec.context.replace(/\n/g, " ")}\n${snippet}`
    : snippet;
  return {
    title: tpl.title,
    rationale: tpl.rationale,
    languageHint: spec.language,
    snippet: annotated,
  };
}

export async function generateAndPersistAutofix(
  userId: number,
  spec: AutofixSpec
): Promise<AutofixResult> {
  const result = generateAutofix(spec);
  await recordAutofix({
    userId,
    findingType: spec.findingType,
    title: result.title,
    rationale: result.rationale,
    languageHint: result.languageHint,
    snippet: result.snippet,
    ...(spec.findingRef ? { findingRef: spec.findingRef } : {}),
  });
  return result;
}
