import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./legalMarkdown";

describe("legalMarkdown", () => {
  it("renders headings, lists, and GFM tables from the published pack shape", () => {
    const html = markdownToHtml(`# Title

Effective date: 12 July 2026

## Roles and scope

Customer is the controller.

- process data only to provide the Service
- notify without undue delay

| Provider | Status |
| -------- | ------ |
| Railway  | Active |
`);
    expect(html).not.toContain("Title");
    expect(html).not.toContain("Effective date");
    expect(html).toContain("Roles and scope");
    expect(html).toContain("Customer is the controller.");
    expect(html).toContain("<li>");
    expect(html).toContain("Railway");
    expect(html).toContain("<table");
  });
});
