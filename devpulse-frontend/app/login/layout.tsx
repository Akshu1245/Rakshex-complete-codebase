import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — RaksHex",
  description: "Sign in to your RaksHex account.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Sign In — RaksHex",
    description: "Sign in to your RaksHex account.",
    url: "https://rakshex.in/login",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
