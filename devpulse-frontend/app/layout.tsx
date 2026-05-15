import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import { CookieConsent } from "../components/CookieConsent";
import { SentryErrorBoundary } from "../components/ErrorBoundary";
import { TRPCProvider } from "@/lib/providers";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"] });

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
  ],
  openGraph: {
    title: "DevPulse — Secure Your AI Agents",
    description:
      "Real-time security scanning, cost anomaly detection, and PII redaction for production LLM applications.",
    type: "website",
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
      <body className={inter.className}>
        <TRPCProvider>
          <AuthProvider>
            <ToastProvider>
              <SentryErrorBoundary>
                <AppShell>{children}</AppShell>
              </SentryErrorBoundary>
              <CookieConsent />
            </ToastProvider>
          </AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
