/**
 * `rakshex secrets` — offline secret pattern scan of a source tree.
 * Each finding has state (pattern_match | likely_secret), confidence and severity.
 * No provider validity check is run, so nothing is ever reported as verified.
 * Exit 1 if effective severity is in --fail-on (default Critical,High).
 */
import { resolve } from "node:path";
import { scanPathForSecrets, listSecretRuleIds, type SecretFinding } from "@rakshex/scanner-core";

export function cmdSecrets(positional: string[], flags: Record<string, string | boolean>): number {
  if (flags.rules === true || positional[0] === "rules") {
    console.log(listSecretRuleIds().join("\n"));
    return 0;
  }

  const target = positional[0];
  if (!target) {
    console.error(
      "Usage: rakshex secrets <path> [--format terminal|json] [--fail-on Critical,High]\n" +
        "       rakshex secrets rules",
    );
    return 2;
  }

  const format = String(flags.format ?? "terminal");
  const failOnRaw = String(flags["fail-on"] ?? "Critical,High")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const failRanks = new Set(failOnRaw.map((s) => s.toLowerCase()));

  let findings: SecretFinding[];
  try {
    findings = scanPathForSecrets(resolve(target));
  } catch (err) {
    console.error(`secrets: ${(err as Error).message}`);
    return 2;
  }

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          target: resolve(target),
          count: findings.length,
          findings,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Secrets scan: ${findings.length} finding(s) in ${resolve(target)}`);
    for (const f of findings) {
      console.log(
        `  [${f.severity} | ${f.state} | confidence ${f.confidence}] ${f.ruleId}: ${f.title} @ ${f.file}:${f.line} (${f.preview})` +
          (f.state === "pattern_match" ? ` — ${f.signals.filter((x) => x.startsWith("placeholder") || x === "weak-randomness").join(", ") || "format match only"}` : ""),
      );
    }
    if (findings.length === 0) console.log("  (clean)");
    console.log("  Not verified: RaksHex does not test keys against providers. Rotate anything real; deleting it from git does not revoke it.");
  }

  const shouldFail = findings.some((f) => failRanks.has(f.severity.toLowerCase()));
  return shouldFail ? 1 : 0;
}
