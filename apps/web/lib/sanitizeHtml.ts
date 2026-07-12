/**
 * Lightweight HTML sanitizer that works in both Node.js and browser
 * without requiring jsdom or DOMPurify.
 * Removes script tags, event handlers, javascript: URLs, and other XSS vectors.
 */
export function sanitizeHtml(html: string): string {
  return (
    html
      // Remove script tags and contents
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Remove event handlers
      .replace(/\s(on\w+)=['"][^'"]*['"]/gi, "")
      // Remove javascript: URLs
      .replace(/href=['"]javascript:[^'"]*['"]/gi, 'href=""')
      .replace(/src=['"]javascript:[^'"]*['"]/gi, 'src=""')
      // Remove data: URLs on src
      .replace(/src=['"]data:[^'"]*['"]/gi, 'src=""')
      // Remove iframe, object, embed
      .replace(/<(iframe|object|embed)[^>]*>[\s\S]*?<\/(iframe|object|embed)>/gi, "")
      // Remove style tags with expressions
      .replace(/style=['"][^'"]*expression[^'"]*['"]/gi, "")
  );
}
