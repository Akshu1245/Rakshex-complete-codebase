import { describe, expect, it } from "vitest";
import { __test } from "./googleBillingReconciliation";

const HEADER =
  "service.description,service.id,sku.id,sku.description,usage_start_time,usage_end_time,project.id,project.name,location.country,location.region,cost,currency,usage.amount,usage.unit,credits,invoice.month,cost_type";

const CSV = [
  HEADER,
  // Quoted comma in sku description + a credit netting against gross cost.
  'Compute Engine,6F81-5844-456A,9B2D-0A63-5D86,"E2 Instance Core, custom",2026-09-23T00:00:00Z,2026-09-24T00:00:00Z,proj-alpha,Alpha,US,us-central1,10.00,USD,4,hour,"[{""amount"": 2.50}]",202609,regular',
  // Simple row, no credits.
  'Cloud Storage,95FF-2EF5-5EA1,0C5D-3A7A-0F7B,Standard Storage,2026-09-23T00:00:00Z,2026-09-24T00:00:00Z,proj-alpha,Alpha,US,us-central1,1.25,USD,100,gibibyte-month,[],202609,regular',
  // Non-USD row: currency recorded, amountUsd unset (never treated as zero).
  'BigQuery,D9A6-D21B-FF9B,E084-9A6E-F5C6,Analysis,2026-09-23T00:00:00Z,2026-09-24T00:00:00Z,proj-beta,Beta,IN,asia-south1,500.00,INR,2,tibibyte,[],202609,regular',
].join("\n");

describe("Google billing export (CSV/GCS path)", () => {
  it("parses RFC-4180 quoted fields and nets credits against gross cost", () => {
    const rows = __test.parseGoogleBillingCsv(CSV);
    expect(rows).toHaveLength(3);

    const compute = rows[0]!;
    expect(compute).toMatchObject({
      rowKind: "cost",
      amountUsd: 7.5, // 10.00 - 2.50 credit
      currency: "usd",
      projectId: "proj-alpha",
      lineItem: "E2 Instance Core, custom",
      model: "Compute Engine",
    });
    expect(compute.bucketStart).toEqual(new Date("2026-09-23T00:00:00Z"));

    const storage = rows[1]!;
    expect(storage.amountUsd).toBe(1.25);
    expect(storage.quantity).toBe(100);
  });

  it("records non-USD rows without an amountUsd so callers never read them as zero", () => {
    const rows = __test.parseGoogleBillingCsv(CSV);
    const inr = rows[2]!;
    expect(inr.currency).toBe("inr");
    expect(inr.amountUsd).toBeUndefined();
    expect(inr.projectId).toBe("proj-beta");
  });

  it("produces stable, bounded source ids for idempotent imports", () => {
    const first = __test.parseGoogleBillingCsv(CSV);
    const second = __test.parseGoogleBillingCsv(CSV);
    expect(first.map((r) => r.sourceRowId)).toEqual(second.map((r) => r.sourceRowId));
    for (const row of first) {
      expect(row.sourceRowId.length).toBeLessThanOrEqual(128);
    }
  });

  it("skips malformed rows instead of emitting bad evidence", () => {
    const rows = __test.parseGoogleBillingCsv(
      `${HEADER}\n,,,,,,,,,,,,,,,\nBad Service,x,y,z,not-a-date,also-bad,p,,,,5.00,USD,,,,,`,
    );
    expect(rows).toHaveLength(0);
  });

  it("returns no rows for an empty export", () => {
    expect(__test.parseGoogleBillingCsv("")).toHaveLength(0);
    expect(__test.parseGoogleBillingCsv(HEADER)).toHaveLength(0);
  });
});
