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

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://devpulse.in";

export const metadata: Metadata = {
  title: "DevPulse — AI Runtime Governance Platform",
  description:
    "Real-time AI Agent Security Scanning, Cost Monitoring & Compliance. Built in India with 4 patents. Scan APIs, detect shadow endpoints, block prompt injection.",
  generator: "DevPulse",
  keywords: [
    "AI security",
    "API scanning",
    "LLM cost monitoring",
    "prompt injection",
    "shadow API detection",
    "PCI DSS compliance",
    "AI governance",
    "LLM runtime security",
    "AI agent protection",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "DevPulse — Secure Your AI Agents",
    description:
      "Real-time security scanning, cost anomaly detection, and PII redaction for production LLM applications.",
    type: "website",
    siteName: "DevPulse",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DevPulse — AI Runtime Governance Platform",
    description: "Real-time AI Agent Security Scanning, Cost Monitoring & Compliance.",
    creator: "@devpulsehq",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
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
