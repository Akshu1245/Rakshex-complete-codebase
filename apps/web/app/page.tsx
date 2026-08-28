import HomePageClient from "./HomePageClient";

export const metadata = {
  title: "Competitors govern the session. RaksHex governs the action.",
  description:
    "RaksHex is an Agent Firewall: runtime authorization for autonomous AI agents. Semantic actions, delegated authority, a hash-chained Action Ledger, and credential mediation so a DENY is enforced, not just logged.",
  alternates: { canonical: "/" },
  keywords: [
    "Agent Firewall",
    "runtime authorization",
    "AI agent security",
    "delegated authority",
    "credential mediation",
    "Action Ledger",
    "RaksHex",
  ],
  openGraph: {
    title: "Competitors govern the session. RaksHex governs the action.",
    description:
      "Runtime authorization for autonomous AI agents. RaksHex governs the action, not the session.",
  },
  twitter: {
    title: "Competitors govern the session. RaksHex governs the action.",
    description:
      "Runtime authorization for autonomous AI agents. RaksHex governs the action, not the session.",
  },
};

export default function Page() {
  return <HomePageClient />;
}
