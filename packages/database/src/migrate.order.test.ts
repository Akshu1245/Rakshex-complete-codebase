import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIGRATION_ORDER } from "./migrate";

const drizzleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

describe("hardcoded migration order", () => {
  it("lists every forward SQL file so new P0 tables cannot silently skip apply", () => {
    const forward = readdirSync(drizzleDir).filter(
      (file) => file.endsWith(".sql") && !file.endsWith(".down.sql"),
    );
    expect([...MIGRATION_ORDER].sort()).toEqual([...forward].sort());
    expect(MIGRATION_ORDER).toEqual(
      expect.arrayContaining([
        "0025_openai_billing_reconciliation.sql",
        "0026_versioned_model_prices.sql",
        "0027_gateway_call_attribution.sql",
        "0028_signed_action_receipts.sql",
      ]),
    );
  });
});
