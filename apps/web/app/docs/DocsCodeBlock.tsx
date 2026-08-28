"use client";

import { useState } from "react";

export function DocsCodeBlock({ code, caption }: { code: string; caption?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="docs-code-block">
      {caption ? <div className="docs-code-caption">{caption}</div> : null}
      <div className="docs-code-pre-wrap">
        <button type="button" className="docs-code-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
