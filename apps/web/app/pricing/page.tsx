import { EVALUATION_PLANS } from "@/lib/billingCatalog";
import { PricingView } from "./PricingView";

export const metadata = {
  title: "Pricing",
  description:
    "RaksHex is in private beta. Evaluation pricing is shown for planning — paid access is by invite or Order Form only, with no self-serve checkout.",
  alternates: { canonical: "/pricing" },
};

// Static catalog copy, labeled as such in the view. The billing backend is
// not connected on this deployment, so there is no live plans endpoint to
// prefer — EVALUATION_PLANS is the catalog, not a fallback.
export default function PricingPage() {
  return <PricingView initialPlans={EVALUATION_PLANS} />;
}
