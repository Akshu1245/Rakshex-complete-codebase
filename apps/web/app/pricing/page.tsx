import { headers } from "next/headers";
import { EVALUATION_PLANS, parseGetPlansPayload, type CatalogPlan } from "@/lib/billingCatalog";
import { PricingView } from "./PricingView";

async function loadCatalog(): Promise<readonly CatalogPlan[]> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return EVALUATION_PLANS;
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    // Same-origin GET that a browser uses. Do not call api.rakshex.in
    // (Railway cert SAN does not include that hostname).
    const res = await fetch(`${proto}://${host}/api/trpc/payment.getPlans`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return EVALUATION_PLANS;
    return parseGetPlansPayload(await res.json()) ?? EVALUATION_PLANS;
  } catch {
    return EVALUATION_PLANS;
  }
}

export default async function PricingPage() {
  const plans = await loadCatalog();
  return <PricingView initialPlans={plans} />;
}
