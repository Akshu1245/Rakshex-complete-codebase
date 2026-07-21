import { describe, expect, it } from "vitest";
import { runScan } from "@rakshex/scanner-core";
import { verifyWebhookSignature } from "../services/githubApp";
import crypto from "crypto";

describe("GitHub CI / App security helpers", () => {
  it("invalid webhook signatures are rejected", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "test-secret-value-at-least-32-chars!!";
    const payload = JSON.stringify({ action: "opened" });
    expect(verifyWebhookSignature(payload, "sha256=deadbeef")).toBe(false);
    expect(verifyWebhookSignature(payload, "")).toBe(false);
  });

  it("valid webhook signature is accepted", () => {
    const secret = "test-secret-value-at-least-32-chars!!";
    process.env.GITHUB_WEBHOOK_SECRET = secret;
    const payload = JSON.stringify({ action: "opened" });
    const sig = `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
    expect(verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it("rejects webhooks when GITHUB_WEBHOOK_SECRET is missing", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const payload = JSON.stringify({ action: "opened" });
    expect(verifyWebhookSignature(payload, "sha256=anything")).toBe(false);
  });

  it("CI scan path produces findings for insecure collections", () => {
    const result = runScan({
      item: [
        {
          request: {
            method: "POST",
            url: "http://api.example.com/users",
            header: [],
          },
        },
      ],
    });
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
