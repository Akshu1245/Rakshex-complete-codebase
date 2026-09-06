/**
 * `rakshex secrets` — high-confidence secret scan of a source tree.
 * Offline, deterministic. Exit 1 if Critical/High findings (default).
 */
import { resolve } from "node:path";
import {
  scanPathForSecrets,
  listSecretRuleIds,
  type SecretFinding,
} from "@rakshex/scanner-core";

export function cmdSecrets(
  positional: string[],
  flags: Record<string, string | boolean>,
): number {
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
        `  [${f.severity}/${f.confidence}] ${f.ruleId}: ${f.title} @ ${f.file}:${f.line} (${f.preview})`,
      );
    }
    if (findings.length === 0) console.log("  (clean)");
  }

  const shouldFail = findings.some((f) => failRanks.has(f.severity.toLowerCase()));
  return shouldFail ? 1 : 0;
}
