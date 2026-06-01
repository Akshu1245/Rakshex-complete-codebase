"use client";

import { useEffect } from "react";

/**
 * Crisp live chat widget.
 *
 * Set NEXT_PUBLIC_CRISP_WEBSITE_ID in your Vercel environment variables
 * to enable Crisp chat. If not set, the component does nothing.
 *
 * Get your Website ID from: https://app.crisp.chat/settings/website/
 */
export function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!websiteId) return;

    // @ts-ignore
    window.$crisp = [];
    // @ts-ignore
    window.CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
