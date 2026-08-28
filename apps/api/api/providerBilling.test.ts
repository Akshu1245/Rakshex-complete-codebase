import { describe, expect, it } from "vitest";
import { openAiBillingKeyShapeError } from "./providerBilling";

describe("optional OpenAI billing checksum key shape", () => {
  it("rejects ordinary inference keys so they cannot be stored as checksum credentials", () => {
    expect(openAiBillingKeyShapeError("sk-live-inference-key")).toMatch(/Admin API key/);
    expect(openAiBillingKeyShapeError("sk-proj-not-an-admin-key")).toMatch(/Admin API key/);
  });

  it("accepts admin-shaped keys for the later live Costs/Usage probe", () => {
    expect(openAiBillingKeyShapeError("sk-admin-read-only-checksum")).toBeNull();
    expect(openAiBillingKeyShapeError("sess-org-admin-style-token")).toBeNull();
  });
});
