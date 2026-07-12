/**
 * Postman / OpenAPI collection credential scan.
 *
 * Postman collections leak credentials surprisingly often — last year's
 * Razorpay disclosure surfaced ~30,000 collections containing live keys
 * (https://www.cloudsek.com/blog/postman-data-leaks-2024). When a user
 * imports a collection we walk the entire JSON tree, concatenate every
 * string-valued field that is plausibly carrying a secret (URL, headers,
 * body, scripts, environment variables) and run the existing
 * `secretScanner` over the result.
 *
 * Output is per-finding with a JSON-pointer-style path so the frontend can
 * highlight where the leak lives in the import file. We never log the raw
 * matched secret — only a redacted preview (handled by `secretScanner`).
 */
import { scanText, type SecretFinding } from "./secretScanner";

export interface CollectionCredentialFinding extends SecretFinding {
  /** JSON-pointer-ish path inside the source collection JSON. */
  path: string;
}

/**
 * Fields we should always treat as carrying-credential candidates regardless
 * of where they appear in the tree. Lower-cased before matching. We err on
 * the side of inclusion — false-positives are filtered by secretScanner.
 */
const CREDENTIAL_LIKE_KEYS = new Set([
  "authorization",
  "auth",
  "token",
  "apikey",
  "api_key",
  "api-key",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "secret",
  "password",
  "key",
  "value", // Postman variables: { key: "AWS_KEY", value: "AKIA..." }
  "raw", // Request body raw-mode field
  "url",
  "exec", // Postman script blocks: { script: { exec: ["..."] } }
]);

interface WalkAcc {
  out: CollectionCredentialFinding[];
  counter: { lines: number };
  basePath: string;
}

function pushFindingsFromText(acc: WalkAcc, path: string, text: string): void {
  if (!text || typeof text !== "string") return;
  const findings = scanText(text);
  for (const f of findings) {
    acc.out.push({ ...f, path });
  }
}

function isCredentialLikeKey(key: string): boolean {
  return CREDENTIAL_LIKE_KEYS.has(key.toLowerCase());
}

function walkValue(acc: WalkAcc, value: unknown, path: string): void {
  if (value == null) return;
  if (typeof value === "string") {
    // Always scan strings — secretScanner is conservative enough that the
    // false-positive rate is low.
    pushFindingsFromText(acc, path, value);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkValue(acc, value[i], `${path}/${i}`);
    }
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = `${path}/${k}`;
      // Two passes: scan stringy values whose key implies credentials, and
      // recurse into everything else.
      if (typeof v === "string" && isCredentialLikeKey(k)) {
        pushFindingsFromText(acc, next, v);
      } else {
        walkValue(acc, v, next);
      }
    }
  }
}

/**
 * Scan a Postman v2.1 collection or OpenAPI document for leaked
 * credentials. Returns a deduplicated finding list (keyed by ruleId+path).
 */
export function scanCollectionForCredentials(collection: unknown): CollectionCredentialFinding[] {
  const acc: WalkAcc = {
    out: [],
    counter: { lines: 0 },
    basePath: "",
  };
  walkValue(acc, collection, "");
  // Dedupe by (ruleId, path, matchPreview) — a single Postman variable can
  // be re-emitted via templating in many requests.
  const seen = new Set<string>();
  const out: CollectionCredentialFinding[] = [];
  for (const f of acc.out) {
    const k = `${f.ruleId}|${f.path}|${f.matchPreview}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}
