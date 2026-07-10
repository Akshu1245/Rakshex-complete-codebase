"use client";

const CONSENT_KEY = "devpulse-cookie-consent";

interface ConsentState {
  analytics: boolean;
  chat: boolean;
  timestamp: string;
}

function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === true;
}

export function hasChatConsent(): boolean {
  return getConsent()?.chat === true;
}

export function setConsent(accepted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        analytics: accepted,
        chat: accepted,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch {
    // Private browsing — silently skip
  }
}
