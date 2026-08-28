import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Firewall Demo",
  description:
    "Try a public RaksHex Agent Firewall decision: change a requested refund amount, evaluate delegated authority, and inspect credential mediation plus Action Ledger evidence.",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title: "RaksHex Agent Firewall Demo",
    description:
      "See an AI action get allowed or denied before execution, including whether the brokered credential is released.",
    url: "/demo",
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
