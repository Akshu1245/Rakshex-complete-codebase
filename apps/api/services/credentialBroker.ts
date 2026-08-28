/**
 * Credential broker — the control that makes the Agent Firewall enforceable.
 *
 * The problem this solves: `agentFirewall.evaluate()` returns a correct
 * decision and writes a tamper-evident ledger record, but on its own it
 * cannot *stop* anything. If the agent holds the real Stripe key, a DENY is
 * a suggestion — the agent can simply call the provider directly. Every
 * "deterministic per-action authority" claim depends on the agent not being
 * able to act without us.
 *
 * The model (CB4A "Model A", proxy gateway):
 *   1. Workspace owner stores a provider secret. It is encrypted at rest
 *      (AES-256-GCM, workspace id as AAD) and is never returned by any API.
 *   2. The agent receives only an opaque credential id.
 *   3. To call the provider the agent calls the broker with that id plus a
 *      `ledgerId` proving `evaluate()` ALLOWed this exact semantic action.
 *   4. The broker re-verifies the decision server-side, injects the secret at
 *      egress, and returns only the provider's response.
 *
 * The agent therefore never possesses the credential, and cannot mint a
 * privileged call without a fresh ALLOW record. Bypass stops being a matter
 * of the agent's cooperation.
 *
 * Threat notes, in the order they bite:
 *   - Shadow-mode laundering: in shadow mode `effectiveDecision` is ALLOW even
 *     when the policy said DENY (that is the point of shadow). Brokering on
 *     `effectiveDecision` alone would let anyone execute denied actions just
 *     by leaving the agent in shadow. We require the *true* `decision` to be
 *     ALLOW as well.
 *   - Replay: one ALLOW is one call, enforced by a unique index on
 *     `credential_egress_log.ledger_id` — a DB constraint, not a check we
 *     could race past.
 *   - Credential confusion: a credential minted for `financial.refund` must
 *     not be usable for `financial.payout`, so the ledger's semantic action
 *     is matched against the credential's own allowlist.
 *   - Exfiltration: the secret may only ever be sent to the credential's
 *     registered origin, so a compromised agent cannot redirect it.
 *   - Staleness: an ALLOW is only good briefly, so a decision cannot be
 *     banked and spent much later under changed circumstances.
 */
import crypto from "node:crypto";
import { logger } from "../_core/logger";
import { logSecurityEvent } from "./securityEvents";

/** How long an ALLOW decision remains spendable. */
export const LEDGER_FRESHNESS_MS = 5 * 60 * 1000;

/** Upstream call timeout — a hung provider must not pin a request forever. */
export const BROKER_TIMEOUT_MS = 30_000;

export type CredentialInjection = "bearer" | "header" | "basic";

/** The subset of a ledger row the authorization decision depends on. */
export interface LedgerFacts {
  id: string;
  workspaceId: number;
  semanticAction: string;
  decision: string;
  effectiveDecision: string;
  occurredAt: Date | string | null;
}

/** The subset of a credential row the authorization decision depends on. */
export interface CredentialFacts {
  id: string;
  workspaceId: number;
  status: string;
  allowedActions: string[];
  allowedOrigin: string;
  injection: CredentialInjection;
  headerName: string | null;
}

/**
 * Wildcard match with the same semantics as the policy engine: a trailing
 * `*` is a prefix match, `*` alone matches everything, otherwise exact.
 * Kept identical to @rakshex/action-control so a credential allowlist and a
 * delegated-authority scope can never disagree about what a pattern means.
 */
function matches(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}

/**
 * Normalizes an origin for comparison. Returns null when the URL is unusable
 * or not https — we never send a secret over cleartext.
 */
export function originOf(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return parsed.origin.toLowerCase();
}

/**
 * Blocks private/internal targets. A brokered request is a server-side fetch
 * with a real secret attached, so it is a textbook SSRF sink: without this an
 * agent could point it at cloud metadata or an internal admin service and
 * have us attach credentials to the request.
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "" || h === "0.0.0.0" || h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("169.254.") ||
    h.startsWith("192.168.")
  ) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

export interface AuthorizeInput {
  ledger: LedgerFacts | null;
  credential: CredentialFacts | null;
  workspaceId: number;
  targetUrl: string;
  now?: Date;
}

export interface AuthorizeResult {
  allowed: boolean;
  /** Machine-readable reason codes, safe to log and to return to the caller. */
  reasons: string[];
}

/**
 * Pure authorization decision for a brokered call. Every check that keeps the
 * secret from being misused lives here, with no I/O, so it can be exhaustively
 * tested. `brokerRequest` performs no network call unless this returns allowed.
 */
export function authorizeBrokeredRequest(input: AuthorizeInput): AuthorizeResult {
  const reasons: string[] = [];
  const now = input.now ?? new Date();
  const { ledger, credential } = input;

  if (!credential) {
    reasons.push("credential_not_found");
  } else {
    if (credential.workspaceId !== input.workspaceId) reasons.push("credential_wrong_workspace");
    if (credential.status !== "active") reasons.push("credential_revoked");
  }

  if (!ledger) {
    reasons.push("ledger_record_not_found");
  } else {
    if (ledger.workspaceId !== input.workspaceId) reasons.push("ledger_wrong_workspace");

    // Both must be ALLOW. `effectiveDecision` alone is not sufficient — see
    // the shadow-mode laundering note in the file header.
    if (ledger.decision !== "ALLOW") reasons.push("decision_not_allow");
    if (ledger.effectiveDecision !== "ALLOW") reasons.push("effective_decision_not_allow");

    const occurred = ledger.occurredAt ? new Date(ledger.occurredAt) : null;
    if (!occurred || Number.isNaN(occurred.getTime())) {
      reasons.push("ledger_timestamp_invalid");
    } else {
      const age = now.getTime() - occurred.getTime();
      if (age > LEDGER_FRESHNESS_MS) reasons.push("ledger_record_stale");
      // A record from the future implies clock skew or forgery; refuse rather
      // than let it extend the freshness window.
      if (age < -60_000) reasons.push("ledger_timestamp_in_future");
    }
  }

  if (ledger && credential) {
    const covered = credential.allowedActions?.some((p) => matches(p, ledger.semanticAction));
    if (!covered) reasons.push("action_not_permitted_for_credential");
  }

  const origin = originOf(input.targetUrl);
  if (!origin) {
    reasons.push("target_url_invalid_or_not_https");
  } else {
    if (credential && origin !== credential.allowedOrigin.toLowerCase().replace(/\/$/, "")) {
      reasons.push("target_origin_not_allowed");
    }
    try {
      if (isPrivateHost(new URL(input.targetUrl).hostname)) reasons.push("target_host_private");
    } catch {
      reasons.push("target_url_invalid_or_not_https");
    }
  }

  if (credential?.injection === "header" && !credential.headerName) {
    reasons.push("credential_header_name_missing");
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Builds the auth header for the upstream request. Isolated so the secret
 * touches as little code as possible and the encoding is testable without
 * making a network call.
 */
export function buildAuthHeader(
  injection: CredentialInjection,
  headerName: string | null,
  secret: string,
): { name: string; value: string } {
  switch (injection) {
    case "bearer":
      return { name: "authorization", value: `Bearer ${secret}` };
    case "basic":
      // Providers that use an API key as the basic-auth username with an
      // empty password (Stripe's convention).
      return {
        name: "authorization",
        value: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      };
    case "header":
      if (!headerName) throw new Error("headerName is required for header injection");
      return { name: headerName.toLowerCase(), value: secret };
  }
}

/**
 * Headers a caller may never set on a brokered request. Without this an agent
 * could pass its own `authorization` header and have us forward it, or spoof
 * forwarding headers the provider trusts.
 */
const FORBIDDEN_REQUEST_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "host",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-real-ip",
]);

export function sanitizeForwardHeaders(headers: Record<string, string> | undefined): {
  headers: Record<string, string>;
  dropped: string[];
} {
  const out: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(headers ?? {})) {
    const key = k.toLowerCase();
    if (FORBIDDEN_REQUEST_HEADERS.has(key)) {
      dropped.push(key);
      continue;
    }
    out[key] = v;
  }
  return { headers: out, dropped };
}

/**
 * Strips headers that would leak credential material or set cookies in the
 * agent's context back to the caller.
 */
const STRIPPED_RESPONSE_HEADERS = new Set(["set-cookie", "authorization", "proxy-authenticate"]);

export function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) out[key.toLowerCase()] = value;
  });
  return out;
}

export interface BrokerExecuteInput {
  targetUrl: string;
  method: string;
  secret: string;
  injection: CredentialInjection;
  headerName: string | null;
  headers?: Record<string, string>;
  body?: unknown;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface BrokerExecuteResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
}

/**
 * Performs the upstream call with the secret injected. Assumes authorization
 * has already passed — callers must not invoke this directly.
 */
export async function executeBrokeredCall(input: BrokerExecuteInput): Promise<BrokerExecuteResult> {
  const started = Date.now();
  const doFetch = input.fetchImpl ?? globalThis.fetch;
  const { headers: forwarded, dropped } = sanitizeForwardHeaders(input.headers);
  if (dropped.length) {
    logSecurityEvent("credential_broker_headers_dropped", { dropped });
  }
  const auth = buildAuthHeader(input.injection, input.headerName, input.secret);
  const finalHeaders: Record<string, string> = { ...forwarded, [auth.name]: auth.value };

  const hasBody = input.body != null && !["GET", "HEAD"].includes(input.method.toUpperCase());
  if (hasBody && !finalHeaders["content-type"]) {
    finalHeaders["content-type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? BROKER_TIMEOUT_MS);
  try {
    const response = await doFetch(input.targetUrl, {
      method: input.method.toUpperCase(),
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
      // Never follow a redirect: the provider could 302 us to another host and
      // we would re-attach the secret to a destination that was never vetted.
      redirect: "manual",
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* leave as text */
    }
    return {
      status: response.status,
      headers: sanitizeResponseHeaders(response.headers),
      body: parsed,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Generates an opaque id for broker-owned rows. */
export function brokerId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Redacts anything that looks like the secret from a value before it is
 * logged or returned. Defence in depth: providers sometimes echo the key back
 * in an error body, which would otherwise land in our egress log.
 */
export function redactSecret<T>(value: T, secret: string): T {
  if (!secret || secret.length < 8) return value;
  const serialized = JSON.stringify(value);
  if (!serialized || !serialized.includes(secret)) return value;
  logger.warn("[credentialBroker] upstream response echoed the credential; redacting");
  return JSON.parse(serialized.split(secret).join("[REDACTED]")) as T;
}
