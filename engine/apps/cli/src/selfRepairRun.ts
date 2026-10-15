/**
 * The ONE Self-Repair path: detection/location from this CLI (apiImpact + stripe SDK resolver
 * + consumerImpact), risk/patch/checks/report/approval from @rakshex/self-repair.
 */
import { analyzeApiImpact } from "./apiImpact.js";
import { normalizeConsumerImpact, type ContractChange } from "./consumerImpact.js";
import { runRepair, type RepairInput, type RepairReport, type RepairRule } from "@rakshex/self-repair";

export const STRIPE_ENDIVE_RULES: RepairRule[] = [{
  id: "stripe-endive-checkout-pmt",
  changeIds: ["request-property-removed"],
  path: "/v1/checkout/sessions",
  removed: "payment_method_types",
  added: "allowed_payment_method_types",
  lowRiskValues: ["card"],
  source: "https://docs.stripe.com/changelog/endive/2026-09-30/remove-payment-method-types-checkout-sessions",
}];

export function repairFromContractChanges(
  workspace: string, changes: ContractChange[],
  rest: Omit<RepairInput, "workspace" | "impacts" | "siteValues">,
  hosts = ["api.stripe.com"],
): RepairReport {
  const rep = analyzeApiImpact(workspace, changes as never, { hosts });
  const ci = normalizeConsumerImpact(changes, rep.sites);
  const siteValues: Record<string, Record<string, string>> = {};
  for (const s of rep.sites) siteValues[`${s.file}:${s.line}`] = s.payload.values;
  const ruled = new Set(rest.rules.map((r) => r.path));
  // Only impacts on endpoints a rule targets are repaired; others are listed in the report as out of scope.
  const impacts = ci.impacts.filter((i) => i.verdict !== "response_review" && ruled.has(i.change.path));
  return runRepair({ ...rest, workspace, impacts, siteValues });
}
