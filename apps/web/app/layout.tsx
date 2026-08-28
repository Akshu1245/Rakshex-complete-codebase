import "./globals-insforge.css";
import "./globals.css";
import "./investor-beta.css";
import type { Metadata, Viewport } from "next";
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
    default: "RaksHex — AI Action Control Plane",
    template: "%s | RaksHex",
  },
  description:
    "RaksHex authorizes consequential AI-agent actions before execution, mediates brokered credentials, and records every decision in a tamper-evident Action Ledger.",
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
  metadataBase: new URL(SITE_URL),
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true },
  openGraph: {
    title: "RaksHex — AI Action Control Plane",
    description:
      "Authorize consequential AI-agent actions before execution. Enforce at the credential boundary and keep tamper-evident decision evidence.",
    type: "website",
    siteName: "RaksHex",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "RaksHex — AI Action Control Plane",
    description:
      "Authorize consequential AI-agent actions before execution. Enforce at the credential boundary and keep tamper-evident decision evidence.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
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
