import HomePageClient from "./HomePageClient";

export const metadata = {
  title: { absolute: "RaksHex — AI Action Control Plane" },
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
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "RaksHex",
    url: "https://www.rakshex.in",
    logo: "https://www.rakshex.in/logo.png",
    description:
      "RaksHex is an AI agent Action Control Plane (Agent Firewall). It authorizes consequential AI-agent actions before execution, mediates brokered credentials, and records every decision in a tamper-evident Action Ledger.",
    sameAs: [
      "https://github.com/Akshu1245/Rakshex-complete-codebase",
      "https://www.instagram.com/rakshex.in",
      "https://www.reddit.com/u/RaksHex_in/s/8zzCSUdomW",
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
