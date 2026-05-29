import "./globals-insforge.css";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import { CookieConsent } from "../components/CookieConsent";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OfflineBanner } from "../components/OfflineBanner";
import { TRPCProvider } from "@/lib/providers";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { TrialBanner } from "@/app/components/TrialBanner";

// Inter kept for fallback but primary fonts loaded via CSS
const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rakshex.in";

export const metadata: Metadata = {
  title: "Rakshex — API Security & LLM Cost Intelligence",
  description:
    "API Security & LLM Cost Intelligence. Built in India. Protected by 4 Patents. Scan APIs, detect shadow endpoints, block prompt injection, attribute LLM costs.",
  generator: "Rakshex",
  keywords: [
    "API security",
    "LLM cost monitoring",
    "prompt injection detection",
    "shadow API detection",
    "PCI DSS compliance",
    "AI governance",
    "LLM runtime security",
    "AI agent protection",
    "OWASP API Top 10",
    "Rakshex",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Rakshex — Secure Your APIs & Control LLM Costs",
    description:
      "Real-time OWASP API scanning, LLM cost attribution, thinking token tracking, and PCI DSS compliance. Built in India with 4 patents.",
    type: "website",
    siteName: "Rakshex",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rakshex — API Security & LLM Cost Intelligence",
    description: "API Security & LLM Cost Intelligence. Built in India. Protected by 4 Patents.",
    creator: "@rakshexhq",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@600;700&display=swap"
        />
      </head>
      <body className={inter.className} style={{ backgroundColor: "#0a0a0a" }}>
        <TRPCProvider>
          <AuthProvider>
            <TrialBanner />
            <ToastProvider>
              <ErrorBoundary>
                <OfflineBanner />
                <AppShell>{children}</AppShell>
              </ErrorBoundary>
              <CookieConsent />
            </ToastProvider>
          </AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
