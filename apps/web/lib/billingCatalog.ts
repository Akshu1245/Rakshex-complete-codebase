/**
 * Fallback copy of the server billing catalog (`PLAN_CONFIG` /
 * `payment.getPlans`). Amounts and feature bullets must stay identical to
 * that procedure — this is not a second price list.
 *
 * Production same-origin GET `/api/trpc/payment.getPlans` already returns
 * this catalog. `/pricing` prefers that GET; this module is used only when
 * the GET fails or has not arrived yet, so first paint is not "Loading plans…".
 */
export type EvaluationPlanId = "free" | "pro" | "enterprise";

export type EvaluationPlan = {
  id: EvaluationPlanId;
  name: string;
  usdAmount: number;
  amount: number;
  currency: "INR";
  interval: "monthly";
  features: readonly string[];
  popular?: boolean;
};

export const EVALUATION_PLANS: readonly EvaluationPlan[] = [
  {
    id: "free",
    name: "Rakshex Free",
    usdAmount: 0,
    amount: 0,
    currency: "INR",
    interval: "monthly",
    features: [
      "Up to 5 API endpoints scanned",
      "100 LLM calls/day routed via the gateway",
      "OWASP Top 10 audit (read-only)",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Rakshex Pro",
    usdAmount: 9900,
    amount: 829900,
    currency: "INR",
    interval: "monthly",
    popular: true,
    features: [
      "Up to 10,000 LLM calls/day routed via the gateway",
      "Unlimited API collections + Postman/OpenAPI scans",
      "Inline kill-switch + budget caps",
      "PII redaction at the gateway",
      "85+ prompt-injection payload red-team library",
      "Spec-drift / shadow API detection",
      "Token analytics + per-model cost forecasting",
      "Up to 5 team members",
      "Email support, 1-business-day SLA",
    ],
  },
  {
    id: "enterprise",
    name: "Rakshex Enterprise",
    usdAmount: 49900,
    amount: 4159900,
    currency: "INR",
    interval: "monthly",
    features: [
      "Up to 250,000 LLM calls/day routed via the gateway",
      "Everything in Pro",
      "MCP governance: tool-call audit + permission graph",
      "Scheduled AI red-team runs",
      "Up to 25 team members + RBAC roles",
      "OWASP / PCI-prep / GDPR-prep / SOC2-prep evidence export",
      "Slack + webhook + PagerDuty alerting",
      "Priority support, 4-hour SLA on P1",
    ],
  },
] as const;

export function evaluationPlanById(id: EvaluationPlanId): EvaluationPlan {
  const plan = EVALUATION_PLANS.find((p) => p.id === id);
  if (!plan) {
    throw new Error(`Unknown evaluation plan: ${id}`);
  }
  return plan;
}

export type CatalogPlan = {
  id: string;
  name: string;
  usdAmount: number;
  amount: number;
  features: readonly string[];
};

/** Decode a tRPC superjson GET envelope or a raw plan array. */
export function parseGetPlansPayload(payload: unknown): CatalogPlan[] | null {
  let data: unknown = payload;
  if (payload && typeof payload === "object" && "result" in payload) {
    data = (payload as { result?: { data?: { json?: unknown } } }).result?.data?.json;
  }
  if (!Array.isArray(data)) return null;
  const plans: CatalogPlan[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string") continue;
    if (typeof r.usdAmount !== "number" || typeof r.amount !== "number") continue;
    if (!Array.isArray(r.features)) continue;
    plans.push({
      id: r.id,
      name: r.name,
      usdAmount: r.usdAmount,
      amount: r.amount,
      features: r.features.filter((f): f is string => typeof f === "string"),
    });
  }
  return plans.length > 0 ? plans : null;
}
