/**
 * `rakshex secrets` — offline secret pattern scan of a source tree.
 * Each finding has state (pattern_match | likely_secret), confidence and severity.
 * No provider validity check is run, so nothing is ever reported as verified.
 * Gate: exit 1 if any finding's effective severity is in the policy's failOn (default Critical,High;
 * --fail-on overrides) and no valid, unexpired allowlist entry (human review record) covers it.
 * Policy: <target>/.rakshex/secrets-policy.json or --policy. Allowlist: <target>/.rakshex/secrets-allowlist.json
 * or --allowlist. Nothing is sent over the network.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  scanPathForSecrets,
  listSecretRuleIds,
  evaluateGate,
  loadAllowlist,
  loadPolicy,
  type SecretFinding,
  type SecretSeverity,
} from "@rakshex/scanner-core";

export function cmdSecrets(positional: string[], flags: Record<string, string | boolean>): number {
  if (flags.rules === true || positional[0] === "rules") {
    console.log(listSecretRuleIds().join("\n"));
    return 0;
  }

  const target = positional[0];
  if (!target) {
    console.error(
      "Usage: rakshex secrets <path> [--format terminal|json] [--fail-on Critical,High] [--policy f] [--allowlist f]\n" +
        "       rakshex secrets rules",
    );
    return 2;
  }

  const format = String(flags.format ?? "terminal");
  const abs = resolve(target);
  let base = abs;
  try {
    if (statSync(abs).isFile()) base = dirname(abs);
  } catch {
    /* reported below */
  }
  const policyPath =
    typeof flags.policy === "string"
      ? resolve(flags.policy)
      : join(base, ".rakshex", "secrets-policy.json");
  const allowPath =
    typeof flags.allowlist === "string"
      ? resolve(flags.allowlist)
      : join(base, ".rakshex", "secrets-allowlist.json");
  if (typeof flags.allowlist === "string" && !existsSync(allowPath)) {
    console.error(`secrets: allowlist not found: ${allowPath}`);
    return 2;
  }
  let policy;
  try {
    policy = loadPolicy(policyPath);
  } catch (err) {
    console.error(`secrets: invalid policy ${policyPath}: ${(err as Error).message}`);
    return 2;
  }
  if (typeof flags["fail-on"] === "string") {
    policy = {
      failOn: String(flags["fail-on"])
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as SecretSeverity[],
    };
  }

  let findings: SecretFinding[];
  try {
    findings = scanPathForSecrets(abs);
  } catch (err) {
    console.error(`secrets: ${(err as Error).message}`);
    return 2;
  }
  const gate = evaluateGate(findings, policy, loadAllowlist(allowPath));

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          target: abs,
          count: findings.length,
          policy: gate.policy,
          exitCode: gate.exitCode,
          allowlistErrors: gate.allowlistErrors,
          expiredIgnored: gate.expiredIgnored,
          findings: gate.decisions.map((d) => ({
            ...d.finding,
            gate: d.outcome,
            review: d.review,
            gate_note: d.note,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `Secrets scan: ${findings.length} finding(s) in ${abs} (fail on: ${gate.policy.failOn.join(",") || "nothing"})`,
    );
    for (const d of gate.decisions) {
      const f = d.finding;
      const tag =
        d.outcome === "fail"
          ? "FAIL"
          : d.outcome === "allowlisted"
            ? `ALLOWLISTED ${d.review!.id} (owner ${d.review!.owner}, until ${d.review!.expires})`
            : "info";
      console.log(
        `  [${tag}] [${f.severity} | ${f.classification} | confidence ${f.detection_confidence} | impact-if-real ${f.potential_impact} | ${f.verification_status}] ` +
          `${f.ruleId} @ ${f.file}:${f.line} (${f.preview}) — ${f.signals.join(", ")}` +
          (d.note ? ` — ${d.note}` : ""),
      );
    }
    if (findings.length === 0) console.log("  (clean)");
    for (const e of gate.allowlistErrors) console.log(`  allowlist error: ${e}`);
    for (const e of gate.expiredIgnored) console.log(`  allowlist entry ignored: ${e}`);
    console.log(
      "  Not verified: RaksHex does not test keys against providers. Rotate anything real; deleting it from git does not revoke it.",
    );
  }
  return gate.exitCode;
}
