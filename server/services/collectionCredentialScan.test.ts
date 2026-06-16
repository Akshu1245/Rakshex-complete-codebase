// @ts-nocheck
import { describe, expect, it } from "vitest";
import { scanCollectionForCredentials } from "./collectionCredentialScan";

describe("scanCollectionForCredentials", () => {
  it("detects AWS keys hidden in Postman variable values", () => {
    const collection = {
      info: { name: "Demo" },
      variable: [
        { key: "AWS_KEY", value: "AKIAIOSFODNN7EXAMPLE", type: "string" },
        { key: "AWS_SECRET", value: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
      ],
    };
    const findings = scanCollectionForCredentials(collection);
    expect(findings.find((f) => f.ruleId === "aws_access_key")).toBeTruthy();
    expect(findings[0]?.path).toContain("/variable/");
  });

  it("detects keys in request authorization headers", () => {
    const collection = {
      info: { name: "Demo" },
      item: [
        {
          name: "Test request",
          request: {
            method: "GET",
            url: "https://api.example.com/users",
            header: [
              {
                key: "Authorization",
                value: `Bearer sk-${"a".repeat(48)}`,
              },
            ],
          },
        },
      ],
    };
    const findings = scanCollectionForCredentials(collection);
    expect(findings.find((f) => f.ruleId === "openai_api_key")).toBeTruthy();
  });

  it("detects keys embedded in raw request bodies", () => {
    const collection = {
      info: { name: "Demo" },
      item: [
        {
          request: {
            method: "POST",
            url: "https://api.razorpay.com/v1/payments",
            body: {
              mode: "raw",
              raw: `{ "key_id": "rzp_live_xxxxx", "secret": "ghp_${"a".repeat(40)}" }`,
            },
          },
        },
      ],
    };
    const findings = scanCollectionForCredentials(collection);
    expect(findings.find((f) => f.ruleId === "github_pat")).toBeTruthy();
  });

  it("detects secrets inside Postman pre-request script exec arrays", () => {
    const collection = {
      info: { name: "Demo" },
      item: [
        {
          name: "Test",
          event: [
            {
              listen: "prerequest",
              script: {
                exec: ["// uses env", `pm.environment.set("token", "ghp_${"b".repeat(40)}");`],
              },
            },
          ],
          request: { method: "GET", url: "https://example.com/healthz" },
        },
      ],
    };
    const findings = scanCollectionForCredentials(collection);
    expect(findings.find((f) => f.ruleId === "github_pat")).toBeTruthy();
  });

  it("returns an empty list for clean collections", () => {
    const collection = {
      info: { name: "Clean" },
      item: [
        {
          name: "Health",
          request: {
            method: "GET",
            url: "https://api.example.com/health",
            header: [{ key: "Accept", value: "application/json" }],
          },
        },
      ],
    };
    expect(scanCollectionForCredentials(collection)).toEqual([]);
  });

  it("dedupes the same secret reported from multiple paths", () => {
    const repeated = `sk-${"c".repeat(48)}`;
    const collection = {
      info: { name: "Demo" },
      variable: [{ key: "openai", value: repeated }],
      item: [
        {
          request: {
            url: "https://api.openai.com/v1/chat/completions",
            header: [{ key: "Authorization", value: `Bearer ${repeated}` }],
          },
        },
      ],
    };
    const findings = scanCollectionForCredentials(collection);
    // Same preview at two different paths → both kept (different paths),
    // but never duplicated within the same path.
    const previews = new Set(findings.map((f) => f.matchPreview));
    expect(previews.size).toBeGreaterThan(0);
    // The dedupe key is (ruleId, path, preview) — same path with same rule
    // and same preview should never appear twice.
    const keys = new Set(findings.map((f) => `${f.ruleId}|${f.path}|${f.matchPreview}`));
    expect(keys.size).toBe(findings.length);
  });
});
