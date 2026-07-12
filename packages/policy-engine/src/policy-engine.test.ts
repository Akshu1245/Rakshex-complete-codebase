import { describe, expect, it } from "vitest";
import { compilePolicy } from "./compile.js";
import { evaluatePolicy, simulatePolicy } from "./evaluate.js";
import { parsePolicy, PolicyParseError } from "./parse.js";
import { PolicyImmutabilityError, PolicyStore, validatePolicyYaml } from "./lifecycle.js";

const SAMPLE_YAML = `
version: 1
name: production-guardrails
agent:
  max_steps: 15
  max_retries: 3
  max_cost_usd: 0.50
  timeout_seconds: 120
models:
  allow:
    - openai/gpt-5-mini
    - anthropic/claude-sonnet
tools:
  deny:
    - execute_shell
  require_approval:
    - send_email
    - transfer_money
    - delete_record
data:
  block:
    - api_key
    - credit_card
    - aadhaar
    - pan
network:
  allow_domains:
    - api.example.com
`;

describe("parsePolicy", () => {
  it("parses rebuild-plan sample YAML", () => {
    const doc = parsePolicy(SAMPLE_YAML);
    expect(doc.version).toBe(1);
    expect(doc.agent?.max_steps).toBe(15);
    expect(doc.tools?.deny).toContain("execute_shell");
    expect(doc.data?.block).toContain("aadhaar");
  });

  it("rejects bad version", () => {
    expect(() => parsePolicy("version: 99\n")).toThrow(PolicyParseError);
  });
});

describe("evaluatePolicy", () => {
  const policy = parsePolicy(SAMPLE_YAML);
  const compiled = compilePolicy(policy);

  it("allows a clean request", () => {
    const d = evaluatePolicy(compiled, {
      model: "gpt-5-mini",
      provider: "openai",
      step: 1,
      costUsdSoFar: 0.01,
    });
    expect(d.action).toBe("allow");
  });

  it("denies over max_steps", () => {
    const d = evaluatePolicy(compiled, { step: 20 });
    expect(d.action).toBe("deny");
    expect(d.matchedRules).toContain("agent.max_steps");
  });

  it("denies execute_shell", () => {
    const d = evaluatePolicy(compiled, { toolName: "execute_shell" });
    expect(d.action).toBe("deny");
  });

  it("requires approval for send_email", () => {
    const d = evaluatePolicy(compiled, { toolName: "send_email" });
    expect(d.action).toBe("require_approval");
  });

  it("blocks credit_card labels", () => {
    const d = evaluatePolicy(compiled, { dataLabels: ["credit_card"] });
    expect(d.action).toBe("deny");
  });

  it("denies off-allowlist network", () => {
    const d = evaluatePolicy(compiled, { destination: "https://evil.example/hook" });
    expect(d.action).toBe("deny");
    expect(d.matchedRules).toContain("network.allow_domains");
  });

  it("allows api.example.com", () => {
    const d = evaluatePolicy(compiled, { destination: "api.example.com" });
    expect(d.action).toBe("allow");
  });

  it("simulatePolicy runs dry cases", () => {
    const results = simulatePolicy(policy, [
      { toolName: "send_email" },
      { toolName: "execute_shell" },
    ]);
    expect(results[0]?.decision.action).toBe("require_approval");
    expect(results[1]?.decision.action).toBe("deny");
  });
});

describe("policy lifecycle", () => {
  it("rejects invalid policies", () => {
    const bad = validatePolicyYaml("version: 99\n");
    expect(bad.ok).toBe(false);
  });

  it("published policies are immutable", () => {
    const store = new PolicyStore();
    store.createDraft("p1", SAMPLE_YAML);
    store.publish("p1", "admin@example.com");
    expect(() => store.updateDraft("p1", SAMPLE_YAML + "\n# edit\n")).toThrow(
      PolicyImmutabilityError,
    );
  });

  it("dry-run records violation but does not change semantics of action", () => {
    const store = new PolicyStore();
    store.createDraft("p1", SAMPLE_YAML);
    store.publish("p1", "admin");
    const d = store.dryRun("p1", { toolName: "execute_shell" });
    expect(d.action).toBe("deny");
    expect(store.getViolations("p1")[0]?.dryRun).toBe(true);
  });

  it("enforcement matches simulation", () => {
    const store = new PolicyStore();
    store.createDraft("p1", SAMPLE_YAML);
    store.publish("p1", "admin");
    const ctx = { step: 20 };
    const sim = store.simulate("p1", [ctx])[0]!.decision;
    const enf = store.enforce("p1", ctx);
    expect(enf.action).toBe(sim.action);
    expect(enf.matchedRules).toEqual(sim.matchedRules);
  });
});
