import HomePageClient from "./HomePageClient";

export const metadata = {
  title: "RaksHex — AI Action Control Plane",
  description:
    "RaksHex authorizes consequential AI-agent actions before execution, mediates brokered credentials, and records every decision in a tamper-evident Action Ledger.",
  alternates: { canonical: "/" },
  keywords: [
    "AI Action Control Plane",
    "Agent Firewall",
    "runtime authorization",
    "AI agent security",
    "delegated authority",
    "credential mediation",
    "Action Ledger",
    "RaksHex",
  ],
  openGraph: {
    title: "RaksHex — AI Action Control Plane",
    description:
      "Authorize consequential AI-agent actions before execution. Enforce at the credential boundary and keep tamper-evident decision evidence.",
  },
  twitter: {
    title: "RaksHex — AI Action Control Plane",
    description:
      "Authorize consequential AI-agent actions before execution. Enforce at the credential boundary and keep tamper-evident decision evidence.",
  },
};

export default function Page() {
  return <HomePageClient />;
}
