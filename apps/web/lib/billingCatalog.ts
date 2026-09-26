/**
 * Static catalog copy of the plan definitions (mirrors the former
 * `payment.getPlans` server procedure). Amounts match that catalog; feature
 * bullets were reworded from the pre-pivot scanner framing to the current
 * Agent Firewall story (the scanner is a layer inside the control plane,
 * never the lead).
 *
 * Rendered as catalog information only, never as live account state: the
 * billing backend is not connected on this deployment, so plan state,
 * invoices, and checkout answer 501 `not_connected` from `/api/billing`.
 * `/pricing` and `/billing` render this copy with that label; first paint is
 * never "Loading plans…".
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
      "Up to 5 agent actions evaluated per day",
      "100 LLM calls/day routed via the gateway",
      "Prompt-injection surface scan on your API surface",
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
      "Up to 10,000 agent actions evaluated per day",
      "Unlimited API collections + Postman/OpenAPI import",
      "Inline kill-switch + budget caps",
      "PII redaction at the gateway",
      "Prompt-injection red-team payload library",
      "Shadow API detection",
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
      "Up to 250,000 agent actions evaluated per day",
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
