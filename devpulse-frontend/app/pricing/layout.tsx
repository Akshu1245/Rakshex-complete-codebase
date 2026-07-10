import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — RaksHex AI Security Platform",
  description: "Free, Pro at $99/mo, and Enterprise at $499/mo. Start free, scale when ready.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing — RaksHex AI Security Platform",
    description: "Free, Pro at $99/mo, and Enterprise at $499/mo. Start free, scale when ready.",
    url: "https://devpulse.ai/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
