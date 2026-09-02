import { redirect } from "next/navigation";

export default function PricingPage() {
  redirect("/waitlist?utm_source=pricing-route&utm_medium=website&utm_campaign=private-beta");
}
