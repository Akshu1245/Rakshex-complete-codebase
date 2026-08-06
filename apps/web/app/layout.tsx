import "./globals-insforge.css";
import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "../components/AuthProvider";
import { CookieConsent } from "../components/CookieConsent";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OfflineBanner } from "../components/OfflineBanner";
import { TRPCProvider } from "@/lib/providers";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { TrialBanner } from "@/app/components/TrialBanner";
import { CrispChat } from "@/components/CrispChat";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rakshex.in";

export const metadata: Metadata = {
  title: {
    default: "RaksHex — AI Runtime Governance, Prompt Injection & LLM Cost Control",
    template: "%s | RaksHex",
  },
  description:
    "India's AI Runtime Governance platform. Block prompt injection, control LLM costs, discover shadow APIs, and generate compliance reports in one place.",
  keywords: [
    "AI runtime governance",
    "prompt injection blocking",
    "LLM cost control",
    "shadow API discovery",
    "AI agent security",
    "MCP governance",
    "OWASP AI Top 10",
    "RakshEx",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-mark-128.png", sizes: "128x128", type: "image/png" },
      { url: "/icon-mark-256.png", sizes: "256x256", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "RaksHex – AI Runtime Governance & Prompt Injection Protection",
    description:
      "AI Runtime Governance for Indian teams. Block prompt injection, control LLM costs, discover shadow APIs, and generate compliance reports.",
    type: "website",
    siteName: "RaksHex",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RakshEx AI Control Plane",
      },
    ],
  },
  twitter: {
    title: "RaksHex – AI Runtime Governance",
    description: "Block prompt injection, control LLM costs, and govern AI agents with RaksHex.",
    creator: "@rakshexhq",
    images: ["/og-image.png"],
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
        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0d1f1a" />
        <meta name="msapplication-TileColor" content="#0d1f1a" />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="RaksHex — AI Runtime Governance Platform" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:image:alt" content="RaksHex — AI Runtime Governance Platform" />
      </head>
      <body>
        <TRPCProvider>
          <AuthProvider>
            <TrialBanner />
            <ToastProvider>
              <ErrorBoundary>
                <OfflineBanner />
                <AppShell>{children}</AppShell>
                <CrispChat />
              </ErrorBoundary>
              <CookieConsent />
            </ToastProvider>
          </AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
