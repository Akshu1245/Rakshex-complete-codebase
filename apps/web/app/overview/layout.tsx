import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Action Control Plane",
  description:
    "How RaksHex turns AI-agent intent into a governed action using delegated authority, policy evaluation, credential mediation, and tamper-evident decision evidence.",
  alternates: { canonical: "/overview" },
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
