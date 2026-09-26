export const metadata = {
  title: "Agent Firewall",
  description:
    "The RaksHex Agent Firewall evaluates proposed AI agent actions against policy and delegated authority, returning ALLOW, DENY, or APPROVAL_REQUIRED before execution.",
  alternates: { canonical: "/agent-firewall" },
};

export default function AgentFirewallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
