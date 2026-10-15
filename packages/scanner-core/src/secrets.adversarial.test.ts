/**
 * Adversarial tests for context-aware secret classification. Every token-shaped value is GENERATED AT TEST TIME
 * (crypto random bodies, prefixes assembled from parts), so nothing credential-like is committed.
 */
import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { scanTextForSecrets, sha256Hex, type SecretFinding } from "./secrets.js";
import { evaluateGate, validateAllowlist, DEFAULT_POLICY } from "./secrets-policy.js";

const j = (...p: string[]) => p.join("");
const AN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const rand = (n: number, set = AN) =>
  Array.from(randomBytes(n), (b) => set[b % set.length]).join("");
const WORDS = ["example", "EXAMPLE", "test", "fake", "dummy", "sample", "Example", "placeholder"];

/** provider prefix, body generator (realistic length/alphabet), impact if real */
const FORMATS: { name: string; pre: string; body: (w: string) => string; impact: string }[] = [
  {
    name: "stripe-live",
    pre: j("sk", "_live_"),
    body: (w) => rand(14) + w + rand(14),
    impact: "Critical",
  },
  {
    name: "stripe-restricted",
    pre: j("rk", "_live_"),
    body: (w) => rand(20) + w + rand(10),
    impact: "High",
  },
  {
    name: "github-pat",
    pre: j("gh", "p_"),
    body: (w) => rand(16) + w + rand(20),
    impact: "Critical",
  },
  {
    name: "openai-project",
    pre: j("sk", "-proj-"),
    body: (w) => rand(30) + w + rand(30),
    impact: "Critical",
  },
  {
    name: "anthropic",
    pre: j("sk", "-ant-api03-"),
    body: (w) => rand(40) + w + rand(40),
    impact: "Critical",
  },
  {
    name: "slack-bot",
    pre: j("xo", "xb-"),
    body: (w) =>
      rand(12, "0123456789") + "-" + rand(12, "0123456789") + "-" + rand(10) + w + rand(10),
    impact: "High",
  },
  {
    name: "aws",
    pre: j("AK", "IA"),
    body: (w) => (rand(9, UP) + w.toUpperCase() + rand(16, UP)).slice(0, 16),
    impact: "Critical",
  },
];

const one = (line: string, file = "src/config.ts"): SecretFinding => {
  const f = scanTextForSecrets(line, file);
  expect(f.length, line.slice(0, 12)).toBeGreaterThan(0);
  return f[0]!;
};

describe("adversarial: realistic tokens with placeholder words embedded are NOT exempted", () => {
  for (const fmt of FORMATS) {
    for (const w of WORDS) {
      it(`${fmt.name} containing "${w}"`, () => {
        const v = fmt.pre + fmt.body(w);
        for (const [line, file] of [
          [`const KEY = "${v}";`, "src/config.ts"],
          [`const KEY = "${v}"; // fake example key for tests`, "tests/fixtures/keys.test.ts"],
          [`# sample: ${v}`, "docs/examples/README.md"],
        ] as const) {
          const f = one(line, file);
          // Never exempted by the substring, path or comment: never synthetic/known-dummy, always gated.
          expect(
            ["synthetic_placeholder", "known_dummy"],
            `${file}: ${f.signals.join(",")}`,
          ).not.toContain(f.classification);
          expect(DEFAULT_POLICY.failOn).toContain(f.severity);
          if (fmt.name !== "aws") {
            // long bodies: the random part dominates -> plausible, full impact
            expect(f.classification, `${file}: ${f.signals.join(",")}`).toBe(
              "plausible_credential",
            );
            expect(f.severity).toBe(fmt.impact);
          }
          expect(f.potential_impact).toBe(fmt.impact);
          expect(f.verification_status).toBe("not_verified");
        }
      });
    }
  }
});

describe("known literal documentation dummies (exact hash) are Info, near-misses are not", () => {
  // Published AWS / Stripe documentation examples, assembled from parts.
  const DUMMIES = [
    j("AK", "IA", "IOSFODNN7", "EXAMPLE"),
    j("AK", "IA", "I44QH8DHB", "EXAMPLE"),
    j("sk", "_test_", "4eC39HqLyjWDarjtT1zdp7dc"),
    j("sk", "_test_", "BQokikJOvBiI2HlWgH4olfQ2"),
  ];
  for (const d of DUMMIES) {
    it(`exact dummy ${d.slice(0, 4)}… -> known_dummy / Info`, () => {
      expect(one(`k = "${d}"`)).toMatchObject({
        classification: "known_dummy",
        severity: "Info",
        detection_confidence: "low",
      });
    });
  }
  it("one character changed is no longer a known dummy and stays suspicious", () => {
    const near = j("AK", "IA", "IOSFODNN7", "EXAMPLF");
    const f = one(`k = "${near}"`);
    expect(f.classification).not.toBe("known_dummy");
    expect(["Critical", "High"]).toContain(f.severity);
  });
});

describe("demonstrably synthetic placeholders are Info (value-based, not substring-based)", () => {
  const live = j("sk", "_live_");
  const cases: Record<string, string> = {
    "x-template": "x".repeat(32),
    "star-template": "*".repeat(24).replace(/\*/g, "X"),
    repeated: "0".repeat(32),
    periodic: "abcd".repeat(8),
    "word-periodic": "EXAMPLE".repeat(5),
    sequence: "1234567890abcdefghijklmnopqrstuv",
    "your-key-template": "YOUR_SECRET_KEY_HERE_xxxxxxxxxxxx".replace(/_/g, ""),
    "fake-filler": "FAKE" + "abcd".repeat(7),
    "words-only": "testexampledummysampletokenkey",
  };
  for (const [k, body] of Object.entries(cases)) {
    it(k, () => {
      const f = one(`k = "${live}${body}"`);
      expect(f, f.signals.join(",")).toMatchObject({
        classification: "synthetic_placeholder",
        severity: "Info",
        potential_impact: "Critical",
      });
    });
  }
});

describe("ambiguous values are shown transparently, not dropped", () => {
  it("weak randomness without synthetic evidence -> ambiguous, severity one step below impact", () => {
    const f = one(`k = "${j("sk", "_live_")}tZpR8wQQ5MQ5MZZpwp88QRtMRwRt5w"`);
    expect(f.classification).toBe("ambiguous");
    expect(f.severity).toBe("High");
    expect(f.signals).toContain("ambiguous:weak-randomness");
  });
});

describe("CI gate + allowlist (auditable review record)", () => {
  const crit = one(`k = "${j("sk", "_live_")}${rand(32)}"`, "src/pay.ts");
  const info = one(`k = "${j("sk", "_live_")}${"x".repeat(32)}"`, "src/pay.ts");
  const base = {
    justification: "rotated 2026-10-01, value is revoked",
    owner: "payments-team",
    reviewed_by: "akshay",
    created: "2026-10-15",
  };
  const now = new Date("2026-10-15T12:00:00Z");

  it("High/Critical plausible findings fail by default; Info passes", () => {
    expect(evaluateGate([crit], DEFAULT_POLICY, { entries: [], errors: [] }, now).exitCode).toBe(1);
    expect(evaluateGate([info], DEFAULT_POLICY, { entries: [], errors: [] }, now).exitCode).toBe(0);
  });
  it("valid entry by exact value hash -> allowlisted with review record, severity unchanged", () => {
    const al = validateAllowlist({
      entries: [
        { id: "LS-1", match: { value_sha256: crit.value_sha256 }, expires: "2026-12-31", ...base },
      ],
    });
    const g = evaluateGate([crit], DEFAULT_POLICY, al, now);
    expect(g.exitCode).toBe(0);
    expect(g.decisions[0]).toMatchObject({
      outcome: "allowlisted",
      review: { id: "LS-1", owner: "payments-team" },
    });
    expect(g.decisions[0]!.finding.severity).toBe("Critical");
  });
  it("valid entry by path+line fingerprint", () => {
    const al = validateAllowlist({
      entries: [
        {
          id: "LS-2",
          match: { location_fingerprint: crit.location_fingerprint },
          rule_id: crit.ruleId,
          expires: "2026-11-01",
          ...base,
        },
      ],
    });
    expect(evaluateGate([crit], DEFAULT_POLICY, al, now).exitCode).toBe(0);
  });
  it("expired entry is ignored -> fails again, with a note", () => {
    const al = validateAllowlist({
      entries: [
        {
          id: "LS-3",
          match: { value_sha256: crit.value_sha256 },
          ...base,
          created: "2026-01-01",
          expires: "2026-10-14",
        },
      ],
    });
    const g = evaluateGate([crit], DEFAULT_POLICY, al, now);
    expect(g.exitCode).toBe(1);
    expect(g.decisions[0]!.note).toMatch(/expired/);
    expect(g.expiredIgnored).toEqual(["LS-3 expired 2026-10-14"]);
  });
  it("rule_id mismatch does not apply", () => {
    const al = validateAllowlist({
      entries: [
        {
          id: "LS-4",
          match: { value_sha256: crit.value_sha256 },
          rule_id: "secret.aws_access_key",
          expires: "2026-12-31",
          ...base,
        },
      ],
    });
    expect(evaluateGate([crit], DEFAULT_POLICY, al, now).exitCode).toBe(1);
  });
  it("malformed entries are rejected: no justification/owner/reviewer, bad hash, both keys, expiry > 365d", () => {
    const h = crit.value_sha256;
    const al = validateAllowlist({
      entries: [
        {
          id: "a",
          match: { value_sha256: h },
          expires: "2026-12-31",
          ...base,
          justification: "ok",
        },
        { id: "b", match: { value_sha256: h }, expires: "2026-12-31", ...base, owner: "" },
        {
          id: "c",
          match: { value_sha256: h },
          expires: "2026-12-31",
          ...base,
          reviewed_by: undefined,
        },
        { id: "d", match: { value_sha256: "abc" }, expires: "2026-12-31", ...base },
        {
          id: "e",
          match: { value_sha256: h, location_fingerprint: crit.location_fingerprint },
          expires: "2026-12-31",
          ...base,
        },
        { id: "f", match: { value_sha256: h }, expires: "2028-01-01", ...base },
        { id: "g", match: { value_sha256: h }, ...base },
      ],
    });
    expect(al.entries).toEqual([]);
    expect(al.errors).toHaveLength(7);
    expect(evaluateGate([crit], DEFAULT_POLICY, al, now).exitCode).toBe(1);
  });
  it("configured policy can also gate Medium (stricter)", () => {
    const amb = one(`k = "${j("sk", "_live_")}tZpR8wQQ5MQ5MZZpwp88QRtMRwRt5w"`);
    expect(
      evaluateGate([amb], { failOn: ["Critical", "High"] }, { entries: [], errors: [] }, now)
        .exitCode,
    ).toBe(1);
  });
  it("finding output never contains the raw value; value_sha256 is a hash", () => {
    const v = j("sk", "_live_") + rand(32);
    const f = one(`k = "${v}"`);
    expect(JSON.stringify(f)).not.toContain(v);
    expect(f.value_sha256).toBe(sha256Hex(v));
  });
});

describe("no external calls", () => {
  it("scanning and gating never call fetch", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const f = scanTextForSecrets(`k = "${j("gh", "p_")}${rand(36)}"`, "src/a.ts");
    evaluateGate(f, DEFAULT_POLICY, { entries: [], errors: [] });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
