import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("removes executable tags and inline handlers", () => {
    const input = '<p onclick="alert(1)">safe</p><script>alert(1)</script><svg onload="alert(1)"></svg>';
    const out = sanitizeHtml(input);

    expect(out).toContain("<p>safe</p>");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("script");
    expect(out).not.toContain("svg");
    expect(out).not.toContain("alert(1)");
  });

  it("keeps safe links and drops dangerous href schemes", () => {
    expect(sanitizeHtml('<a href="https://rakshex.in/docs" target="_blank">docs</a>')).toBe(
      '<a href="https://rakshex.in/docs" rel="noopener noreferrer">docs</a>',
    );
    expect(sanitizeHtml('<a href="javascript:alert(1)">bad</a>')).toBe("<a>bad</a>");
    expect(sanitizeHtml('<a href="data:text/html,boom">bad</a>')).toBe("<a>bad</a>");
  });

  it("drops unknown tags and all non-anchor attributes", () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)"><div style="color:red">ok</div>');
    expect(out).toBe("<div>ok</div>");
  });
});
