import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Demo — RakshEx API Security Scanner",
  description: "Drop your Postman collection and find vulnerabilities in 3 seconds. No signup required.",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title: "Live Demo — RakshEx API Security Scanner",
    description: "Drop your Postman collection and find vulnerabilities in 3 seconds. No signup required.",
    url: "https://rakshex.in/demo",
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
