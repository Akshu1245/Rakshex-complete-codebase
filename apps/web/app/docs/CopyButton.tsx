"use client";

import { useState } from "react";

/**
 * Copy-page button for docs articles. Copies the article's text content to the
 * clipboard, with a legacy execCommand fallback for non-secure contexts.
 */
export function DocsCopyButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const article = document.querySelector(".docs-article");
    const text = article instanceof HTMLElement ? article.innerText : document.body.innerText;

    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback for http / older browsers.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }

    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button className="docs-copy-btn" onClick={handleCopy} type="button">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {copied ? "Copied!" : "Copy page"}
    </button>
  );
}
