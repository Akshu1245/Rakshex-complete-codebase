import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account — RaksHex",
  description: "Start securing your AI agents for free. No credit card required.",
  alternates: {
    canonical: "/register",
  },
  openGraph: {
    title: "Create Account — RaksHex",
    description: "Start securing your AI agents for free. No credit card required.",
    url: "https://devpulse.ai/register",
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
