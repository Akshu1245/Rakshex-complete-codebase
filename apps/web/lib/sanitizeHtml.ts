const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith("/") || href.startsWith("#")) return href;

  try {
    const url = new URL(href);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") {
      return href;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Conservative sanitizer for trusted, compile-time documentation HTML.
 *
 * It intentionally reconstructs every allowed tag instead of attempting to
 * delete individual dangerous attributes. This means event handlers, style,
 * src, srcdoc, data URLs and unknown attributes can never survive. Anchor
 * tags are the only tags that retain an attribute, and href is restricted to
 * relative links plus http(s)/mailto.
 *
 * Do not use this as a general-purpose sanitizer for arbitrary CMS/user HTML.
 * If documentation ever becomes user-controlled, replace this with a mature
 * parser-based sanitizer at the ingestion boundary.
 */
export function sanitizeHtml(html: string): string {
  const withoutDangerousBlocks = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");

  return withoutDangerousBlocks.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (full, rawTag, attrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";

    const isClosing = /^<\//.test(full);
    if (isClosing) return `</${tag}>`;

    if (tag === "br" || tag === "hr") return `<${tag}>`;

    if (tag === "a") {
      const hrefMatch = String(attrs).match(/\bhref\s*=\s*(["'])(.*?)\1/i);
      const href = hrefMatch ? safeHref(hrefMatch[2]) : null;
      if (!href) return "<a>";
      return `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">`;
    }

    return `<${tag}>`;
  });
}
