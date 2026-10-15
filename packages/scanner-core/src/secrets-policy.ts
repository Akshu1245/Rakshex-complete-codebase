/**
 * CI gate + reviewable allowlist for secret findings. Offline: nothing is sent anywhere.
 *
 * Policy (`.rakshex/secrets-policy.json`, optional): { "failOn": ["Critical","High"] }.
 * A finding whose effective severity is in failOn FAILS the gate unless a valid, unexpired allowlist entry
 * (the auditable human review record) covers it.
 *
 * Allowlist (`.rakshex/secrets-allowlist.json`), reviewed in pull requests like code:
 * { "entries": [ {
 *     "id": "LS-001",
 *     "match": { "value_sha256": "<64 hex>" }            // exact value, any location
 *          or  { "location_fingerprint": "<32 hex>" }    // rule + path + line
 *     "rule_id": "secret.stripe_test_key",               // optional extra constraint
 *     "justification": "why this is safe (>= 15 chars)",
 *     "owner": "person or team accountable",
 *     "reviewed_by": "reviewer",
 *     "expires": "YYYY-MM-DD"                            // required, <= 365 days after "created"
 *     "created": "YYYY-MM-DD"
 * } ] }
 * Entries that are malformed are rejected (reported). Expired entries are IGNORED (reported) so the finding
 * fails again. Allowlisting never changes severity or classification; it only records a review decision.
 */
import { existsSync, readFileSync } from "node:fs";
import type { SecretFinding, SecretSeverity } from "./secrets.js";

export interface SecretsPolicy {
  failOn: SecretSeverity[];
}
export const DEFAULT_POLICY: SecretsPolicy = { failOn: ["Critical", "High"] };

export interface AllowlistEntry {
  id: string;
  match: { value_sha256?: string; location_fingerprint?: string };
  rule_id?: string;
  justification: string;
  owner: string;
  reviewed_by: string;
  expires: string;
  created: string;
}

export interface AllowlistLoad {
  entries: AllowlistEntry[];
  errors: string[];
}

const DAY = 86_400_000;
const isDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + "T00:00:00Z"));

export function validateAllowlist(raw: unknown): AllowlistLoad {
  const errors: string[] = [];
  const entries: AllowlistEntry[] = [];
  const list = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return { entries, errors: ["allowlist: missing 'entries' array"] };
  list.forEach((e: any, i) => {
    const where = `allowlist[${i}]${e?.id ? ` (${e.id})` : ""}`;
    const problems: string[] = [];
    if (!e || typeof e !== "object") return errors.push(`${where}: not an object`);
    if (typeof e.id !== "string" || !e.id) problems.push("id required");
    const m = e.match ?? {};
    const hasHash = typeof m.value_sha256 === "string" && /^[0-9a-f]{64}$/.test(m.value_sha256);
    const hasLoc =
      typeof m.location_fingerprint === "string" && /^[0-9a-f]{32}$/.test(m.location_fingerprint);
    if (hasHash === hasLoc)
      problems.push(
        "match needs exactly one of value_sha256 (64 hex) or location_fingerprint (32 hex)",
      );
    if (typeof e.justification !== "string" || e.justification.trim().length < 15)
      problems.push("justification required (>= 15 chars)");
    if (typeof e.owner !== "string" || !e.owner.trim()) problems.push("owner required");
    if (typeof e.reviewed_by !== "string" || !e.reviewed_by.trim())
      problems.push("reviewed_by required");
    if (!isDate(e.created)) problems.push("created must be YYYY-MM-DD");
    if (!isDate(e.expires)) problems.push("expires must be YYYY-MM-DD");
    else if (isDate(e.created) && Date.parse(e.expires) - Date.parse(e.created) > 365 * DAY)
      problems.push("expires must be within 365 days of created");
    if (problems.length) errors.push(`${where}: ${problems.join("; ")}`);
    else entries.push(e as AllowlistEntry);
  });
  return { entries, errors };
}

export function loadAllowlist(path: string | undefined): AllowlistLoad {
  if (!path || !existsSync(path)) return { entries: [], errors: [] };
  try {
    return validateAllowlist(JSON.parse(readFileSync(path, "utf8")));
  } catch (err) {
    return { entries: [], errors: [`allowlist: cannot parse ${path}: ${(err as Error).message}`] };
  }
}

export function loadPolicy(path: string | undefined): SecretsPolicy {
  if (!path || !existsSync(path)) return DEFAULT_POLICY;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const sev = ["Critical", "High", "Medium", "Low", "Info"];
  const failOn = Array.isArray(raw.failOn)
    ? raw.failOn.filter((s: unknown) => typeof s === "string" && sev.includes(s))
    : DEFAULT_POLICY.failOn;
  return { failOn };
}

export interface GateDecision {
  finding: SecretFinding;
  outcome: "fail" | "allowlisted" | "pass";
  review?: Pick<AllowlistEntry, "id" | "owner" | "reviewed_by" | "justification" | "expires">;
  note?: string;
}

export interface GateResult {
  exitCode: 0 | 1;
  decisions: GateDecision[];
  expiredIgnored: string[];
  allowlistErrors: string[];
  policy: SecretsPolicy;
}

export function evaluateGate(
  findings: SecretFinding[],
  policy: SecretsPolicy,
  allow: AllowlistLoad,
  now = new Date(),
): GateResult {
  const today = now.toISOString().slice(0, 10);
  const active = allow.entries.filter((e) => e.expires >= today);
  const expired = allow.entries.filter((e) => e.expires < today);
  const failSet = new Set(policy.failOn);
  const decisions: GateDecision[] = findings.map((f) => {
    const matches = (e: AllowlistEntry) =>
      (!e.rule_id || e.rule_id === f.ruleId) &&
      ((e.match.value_sha256 && e.match.value_sha256 === f.value_sha256) ||
        (e.match.location_fingerprint && e.match.location_fingerprint === f.location_fingerprint));
    const entry = active.find(matches);
    const gated = failSet.has(f.severity);
    if (entry) {
      const { id, owner, reviewed_by, justification, expires } = entry;
      return {
        finding: f,
        outcome: gated ? "allowlisted" : "pass",
        review: { id, owner, reviewed_by, justification, expires },
      };
    }
    const exp = expired.find(matches);
    return {
      finding: f,
      outcome: gated ? "fail" : "pass",
      note: exp ? `allowlist entry ${exp.id} expired ${exp.expires} (ignored)` : undefined,
    };
  });
  return {
    exitCode: decisions.some((d) => d.outcome === "fail") ? 1 : 0,
    decisions,
    expiredIgnored: expired.map((e) => `${e.id} expired ${e.expires}`),
    allowlistErrors: allow.errors,
    policy,
  };
}
