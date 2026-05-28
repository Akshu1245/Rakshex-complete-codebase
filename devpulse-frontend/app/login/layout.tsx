import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — RakshEx",
  description: "Sign in to your RakshEx account.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Sign In — RakshEx",
    description: "Sign in to your RakshEx account.",
    url: "https://rakshex.in/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
