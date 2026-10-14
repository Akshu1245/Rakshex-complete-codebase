/**
 * Shared JSON conformance vectors. The Rust prototype consumes the SAME file.
 * Never approve a Rust routing cutover if the versions disagree.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateAction } from "./evaluate";
import type { EvaluationInput, EvaluationResult } from "./types";

type ParityCase = {
  name: string;
  input: Omit<EvaluationInput, "now"> & { now: string };
  expected: EvaluationResult;
};

const fixtures = JSON.parse(
  readFileSync(
    new URL("../../../rust/action-core/fixtures/policy_cases.json", import.meta.url),
    "utf8",
  ),
) as ParityCase[];

describe("Rust migration: TypeScript policy conformance", () => {
  it("maintains a shared deterministic security contract", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    for (const fixture of fixtures) {
      const result = evaluateAction({
        ...fixture.input,
        now: new Date(fixture.input.now),
      });
      expect(result, fixture.name).toEqual(fixture.expected);
    }
  });
});
