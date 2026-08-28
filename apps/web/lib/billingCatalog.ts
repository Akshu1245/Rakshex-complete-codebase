/**
 * Evaluation billing catalog for public pages.
 *
 * Amounts and feature lists must stay aligned with `PLAN_CONFIG` in
 * `apps/api/payments.ts` (the server catalog `payment.getPlans` returns).
 * `/pricing` renders this module synchronously so a stranger can see
 * evaluation prices when `api.rakshex.in` is unreachable (TLS SAN mismatch
 * or a hung tRPC rewrite). Do not gate this page on a network fetch.
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
