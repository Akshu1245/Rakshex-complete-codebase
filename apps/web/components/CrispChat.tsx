"use client";

import { useEffect } from "react";
import { hasChatConsent } from "@/lib/consent";

/**
 * Crisp live chat widget — only loads when user has accepted chat consent
 * and NEXT_PUBLIC_CRISP_WEBSITE_ID is configured.
 */
export function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!websiteId) return;
    if (!hasChatConsent()) return;

    // @ts-ignore
    window.$crisp = [];
    // @ts-ignore
    window.CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
}
