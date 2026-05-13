// @ts-nocheck  
import { describe, expect, it } from "vitest";

import {
  POLICY_TEMPLATES,
  getPolicyTemplate,
} from "./policyTemplates";
import {
  PolicyValidationException,
  compilePolicy,
  parsePolicy,
} from "./policyDsl";

describe("parsePolicy", () => {
  it("parses a minimal valid policy", () => {
    const yaml = `name: "Min"
version: 1
applies_to: ["all"]
rules:
  - id: pii_redaction
    enabled: true
    redact: [EMAIL]
    action: mask
`;
    const policy = parsePolicy(yaml);
    expect(policy.name).toBe("Min");
    expect(policy.version).toBe(1);
    expect(policy.appliesTo).toEqual(["all"]);
    expect(policy.rules).toHaveLength(1);
  });

  it("rejects non-object root with structured error", () => {
    expect.assertions(2);
    try {
      parsePolicy("- only\n- a list\n");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyValidationException);
      expect((err as PolicyValidationException).errors[0].message).toMatch(
        /must be an object/
      );
    }
  });

  it("rejects malformed YAML with parse error", () => {
    expect.assertions(2);
    try {
      parsePolicy("name: : :\n  bad");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyValidationException);
      expect((err as PolicyValidationException).errors[0].message).toMatch(
        /invalid YAML/
      );
    }
  });

  it("collects multiple field errors instead of failing on first", () => {
    expect.assertions(2);
    try {
      parsePolicy(`name: ""
version: -3
rules: "not an array"
`);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyValidationException);
      const errors = (err as PolicyValidationException).errors;
      expect(errors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("rejects unknown rule id", () => {
    expect.assertions(2);
    try {
      parsePolicy(`name: T
version: 1
applies_to: [all]
rules:
  - id: not_a_real_rule
    enabled: true
`);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyValidationException);
      expect((err as PolicyValidationException).errors[0].message).toMatch(
        /unknown rule id/
      );
    }
  });

  it("rejects out-of-range injection threshold", () => {
    expect.assertions(2);
    try {
      parsePolicy(`name: T
version: 1
rules:
  - id: prompt_injection
    threshold: 250
`);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyValidationException);
      expect((err as PolicyValidationException).errors[0].path).toBe(
        "rules[0].threshold"
      );
    }
  });

  it("validates per-model token caps", () => {
    expect.assertions(2);
    try {
      parsePolicy(`name: T
version: 1
rules:
  - id: token_budget
    per_model_daily_tokens:
      gpt-4o: 10000
      claude-3.5: -50
`);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyValidationException);
      const paths = (err as PolicyValidationException).errors.map(e => e.path);
      expect(paths).toContain("rules[0].per_model_daily_tokens.claude-3.5");
    }
  });

  it("defaults appliesTo to ['all'] when omitted", () => {
    const yaml = `name: T
version: 1
rules:
  - id: kill_switch
    enabled: true
`;
    const policy = parsePolicy(yaml);
    expect(policy.appliesTo).toEqual(["all"]);
  });

  it("defaults rule.enabled to true when omitted", () => {
    const yaml = `name: T
version: 1
rules:
  - id: pii_redaction
    redact: [EMAIL]
`;
    const policy = parsePolicy(yaml);
    expect(policy.rules[0].enabled).toBe(true);
  });
});

describe("compilePolicy", () => {
  it("collapses rules into a runtime view with sane defaults", () => {
    const yaml = `name: T
version: 2
applies_to: ["prod"]
rules:
  - id: pii_redaction
    redact: [EMAIL, PHONE]
    action: hash
  - id: prompt_injection
    threshold: 65
    on_detection: block
`;
    const compiled = compilePolicy(parsePolicy(yaml));
    expect(compiled.name).toBe("T");
    expect(compiled.version).toBe(2);
    expect(compiled.appliesTo).toEqual(["prod"]);
    expect(compiled.pii.enabled).toBe(true);
    expect(compiled.pii.action).toBe("hash");
    expect(compiled.promptInjection.threshold).toBe(65);
    expect(compiled.tokenBudget.enabled).toBe(false);
    expect(compiled.killSwitch.enabled).toBe(false);
  });

  it("later rules of the same kind override earlier ones", () => {
    const yaml = `name: T
version: 1
rules:
  - id: prompt_injection
    threshold: 30
    on_detection: warn
  - id: prompt_injection
    threshold: 90
    on_detection: block
`;
    const compiled = compilePolicy(parsePolicy(yaml));
    expect(compiled.promptInjection.threshold).toBe(90);
    expect(compiled.promptInjection.onDetection).toBe("block");
  });
});

describe("policy templates", () => {
  it("ships the 5 expected templates", () => {
    const ids = POLICY_TEMPLATES.map(t => t.id).sort();
    expect(ids).toEqual([
      "balanced",
      "demo-loose",
      "india-pii",
      "permissive",
      "strict",
    ]);
  });

  it("every template parses and compiles without errors", () => {
    for (const tpl of POLICY_TEMPLATES) {
      const policy = parsePolicy(tpl.yaml);
      const compiled = compilePolicy(policy);
      expect(compiled.name).toBeTruthy();
      expect(compiled.version).toBeGreaterThan(0);
    }
  });

  it("strict template denies tools by default", () => {
    const tpl = getPolicyTemplate("strict");
    expect(tpl).toBeDefined();
    const compiled = compilePolicy(parsePolicy(tpl!.yaml));
    expect(compiled.toolApproval.enabled).toBe(true);
    expect(compiled.toolApproval.denyByDefault).toBe(true);
  });

  it("india-pii template includes Aadhaar/PAN/IFSC", () => {
    const tpl = getPolicyTemplate("india-pii");
    const compiled = compilePolicy(parsePolicy(tpl!.yaml));
    expect(compiled.pii.redact).toContain("AADHAAR");
    expect(compiled.pii.redact).toContain("PAN");
    expect(compiled.pii.redact).toContain("IFSC");
  });

  it("returns undefined for unknown template id", () => {
    expect(getPolicyTemplate("nope")).toBeUndefined();
  });
});
