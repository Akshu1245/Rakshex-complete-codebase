/**
 * POST /v1/evaluate — the Workers firewall slice.
 *
 * action-control evaluate + spend ceilings → signed receipt appended to the
 * D1 ledger → decision + receipt returned. Fail-closed throughout: any
 * missing piece (workspace, key, signing config, spend state) denies or 500s,
 * never allows blind.
 */
import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { evaluateAction } from "@rakshex/action-control";
import type {
  AuthorityScope,
  ControlPolicy,
  Decision,
  EvaluationInput,
  SemanticAction,
  SpendScopeName,
  SpendUsdByScope,
} from "@rakshex/action-control";
import { createDb, type WorkersDb } from "../db";
import type { Env } from "../env";
import { actionReceiptLedger, apiKeys, controlPolicies, spendLedger, workspaces } from "../schema";
import {
  createSignedReceiptEntry,
  GENESIS_HASH,
  signerFromEnvironment,
  type ActionReceiptEventType,
  type ReceiptEntryExport,
} from "../receipts";
import { checkRateLimit } from "../adapters/ratelimit";
import { captureError } from "../adapters/sentry";

export const app = new Hono<{ Bindings: Env }>();

const SPEND_SCOPES: SpendScopeName[] = ["agent", "key", "user"];

/** Map the 8-way firewall decision onto the 4-way receipt event vocabulary. */
export function mapReceiptEvent(decision: Decision): ActionReceiptEventType {
  return decision === "ALLOW" ? "allow" : "deny";
}

export interface EvaluateBody {
  workspaceId: number;
  requestId: string;
  mode?: "enforce" | "shadow";
  action: {
    name: string;
    domain: SemanticAction["domain"];
    effect: SemanticAction["effect"];
    parameters?: Record<string, unknown>;
    resource?: string;
    environment?: string;
    amountMinor?: number;
    currency?: string;
    known?: boolean;
    raw: { provider: string; operation: string; requestId?: string; toolName?: string };
  };
  authority?: AuthorityScope | null;
  estimatedCostUsd?: number;
  agentId?: string;
  keyId?: string;
  userId?: string;
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Bearer API-key auth. Workers-slice scheme: HMAC-SHA256(API_KEY_PEPPER, raw key). */
async function authenticate(
  db: WorkersDb,
  env: Env,
  req: Request,
  workspaceId: number,
): Promise<{ ok: true; keyId: string } | { ok: false; response: Response }> {
  const header = req.headers.get("Authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw) return { ok: false, response: bad("Missing bearer API key", 401) };
  if (!env.API_KEY_PEPPER) {
    return { ok: false, response: bad("API auth is not configured", 500) };
  }
  const keyHash = await hmacHex(env.API_KEY_PEPPER, raw);
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  const now = Date.now();
  if (
    !key ||
    key.workspaceId !== workspaceId ||
    key.revokedAt != null ||
    (key.expiresAt != null && key.expiresAt <= now)
  ) {
    return { ok: false, response: bad("Invalid API key", 401) };
  }
  return { ok: true, keyId: key.id };
}

export interface ScopeSpendRow {
  scope: SpendScopeName;
  total: number;
}

/**
 * Pure helper (unit-testable): fold raw spend sums into the SpendUsdByScope the
 * gate consumes. A scope with a configured ceiling but no identity supplied
 * yields null → evaluateAction DENYs fail-closed ("spend state unknown").
 */
export function buildSpendSoFar(
  ceilings: SpendUsdByScope,
  rows: ScopeSpendRow[],
  ids: { agentId?: string; keyId?: string; userId?: string },
): SpendUsdByScope | undefined {
  if (SPEND_SCOPES.every((s) => ceilings[s] == null)) return undefined;
  const totals = new Map<SpendScopeName, number>(rows.map((r) => [r.scope, r.total]));
  const out: SpendUsdByScope = {};
  for (const scope of SPEND_SCOPES) {
    if (ceilings[scope] == null) continue;
    const id = ids[scope === "agent" ? "agentId" : scope === "key" ? "keyId" : "userId"];
    out[scope] = id == null ? null : (totals.get(scope) ?? 0);
  }
  return out;
}

async function sumScopeSpend(
  db: WorkersDb,
  workspaceId: number,
  scope: SpendScopeName,
  scopeId: string,
): Promise<number> {
  const rows = await db
    .select({
      agentId: spendLedger.agentId,
      keyId: spendLedger.keyId,
      userId: spendLedger.userId,
      costUsd: spendLedger.costUsd,
    })
    .from(spendLedger)
    .where(eq(spendLedger.workspaceId, workspaceId));
  let total = 0;
  for (const row of rows) {
    const rowId = scope === "agent" ? row.agentId : scope === "key" ? row.keyId : row.userId;
    if (rowId === scopeId) total += row.costUsd ?? 0;
  }
  return total;
}

export interface PolicyRecord {
  version: string;
  policy: ControlPolicy;
  mode: "enforce" | "shadow";
  frozen: boolean;
}

export async function loadPolicy(db: WorkersDb, workspaceId: number): Promise<PolicyRecord> {
  const [row] = await db
    .select()
    .from(controlPolicies)
    .where(eq(controlPolicies.workspaceId, workspaceId))
    .limit(1);
  if (!row) {
    return {
      version: "builtin:0.1",
      policy: { version: "builtin:0.1" },
      mode: "enforce",
      frozen: false,
    };
  }
  let parsed: ControlPolicy = { version: row.version };
  try {
    parsed = { version: row.version, ...(JSON.parse(row.policyJson) as Partial<ControlPolicy>) };
  } catch {
    // Corrupt policy JSON fails closed below via frozen flag.
    return {
      version: row.version,
      policy: { version: row.version },
      mode: "enforce",
      frozen: true,
    };
  }
  if (row.spendCeilingsUsdJson) {
    try {
      parsed.spendCeilingsUsd = JSON.parse(row.spendCeilingsUsdJson) as SpendUsdByScope;
    } catch {
      return { version: row.version, policy: parsed, mode: "enforce", frozen: true };
    }
  }
  return {
    version: row.version,
    policy: parsed,
    mode: row.mode === "shadow" ? "shadow" : "enforce",
    frozen: row.frozen === 1,
  };
}

async function appendReceipt(
  db: WorkersDb,
  env: Env,
  input: {
    workspaceId: number;
    requestId: string;
    eventType: ActionReceiptEventType;
    payload: Record<string, unknown>;
  },
): Promise<ReceiptEntryExport> {
  const signer = await signerFromEnvironment(env);
  const [previous] = await db
    .select({ entryHash: actionReceiptLedger.entryHash })
    .from(actionReceiptLedger)
    .where(eq(actionReceiptLedger.workspaceId, input.workspaceId))
    .orderBy(desc(actionReceiptLedger.id))
    .limit(1);
  // NOTE: no cross-request lock on Workers (D1 has no advisory locks). Concurrent
  // evaluates on one workspace can fork the chain; production follow-up is a
  // single-writer queue consumer. See PORT_NOTES.md.
  const now = new Date();
  const nowMs = now.getTime();
  const signed = await createSignedReceiptEntry(
    {
      workspaceId: input.workspaceId,
      requestId: input.requestId,
      eventType: input.eventType,
      occurredAt: now,
      payload: input.payload,
      previousHash: previous?.entryHash ?? GENESIS_HASH,
    },
    signer,
  );
  const inserted = await db
    .insert(actionReceiptLedger)
    .values({
      workspaceId: signed.workspaceId,
      requestId: signed.requestId,
      eventType: signed.eventType,
      occurredAt: nowMs,
      payload: JSON.stringify(signed.payload),
      previousHash: signed.previousHash,
      entryHash: signed.entryHash,
      signingKeyId: signed.signingKeyId,
      signingAlgorithm: signed.signingAlgorithm,
      signature: signed.signature,
      publicKeyPem: signed.publicKeyPem,
      createdAt: nowMs,
    })
    .returning({ id: actionReceiptLedger.id });
  const id = inserted[0]?.id;
  if (id == null) throw new Error("Receipt ledger append returned no id — fail-closed");
  return { ...signed, id };
}

app.post("/", async (c) => {
  const env = c.env;
  const db = createDb(env);
  let body: EvaluateBody;
  try {
    body = (await c.req.json()) as EvaluateBody;
  } catch {
    return bad("Invalid JSON body");
  }
  if (!Number.isInteger(body.workspaceId) || body.workspaceId <= 0)
    return bad("workspaceId is required");
  if (!body.requestId || typeof body.requestId !== "string") return bad("requestId is required");
  if (!body.action?.name || !body.action?.raw?.provider)
    return bad("action.name and action.raw.provider are required");

  const auth = await authenticate(db, env, c.req.raw, body.workspaceId);
  if (!auth.ok) return auth.response;

  const rl = await checkRateLimit(db, `eval:${auth.keyId}`, 120, 60_000);
  if (!rl.allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, body.workspaceId))
      .limit(1);
    if (!workspace) return bad("Unknown workspace", 404);

    const policyRec = await loadPolicy(db, body.workspaceId);

    // Spend state for every scope that has a ceiling configured.
    const ceilings = policyRec.policy.spendCeilingsUsd ?? {};
    const rows: ScopeSpendRow[] = [];
    for (const scope of SPEND_SCOPES) {
      if (ceilings[scope] == null) continue;
      const id = scope === "agent" ? body.agentId : scope === "key" ? body.keyId : body.userId;
      if (id == null) continue; // buildSpendSoFar turns this into null → fail-closed DENY
      rows.push({ scope, total: await sumScopeSpend(db, body.workspaceId, scope, id) });
    }
    const spendSoFarUsd = buildSpendSoFar(ceilings, rows, {
      agentId: body.agentId,
      keyId: body.keyId,
      userId: body.userId,
    });

    const action: SemanticAction = {
      name: body.action.name,
      version: "0.1",
      domain: body.action.domain ?? "unknown",
      effect: body.action.effect ?? "unknown",
      parameters: body.action.parameters ?? {},
      resource: body.action.resource,
      environment: body.action.environment,
      amountMinor: body.action.amountMinor,
      currency: body.action.currency,
      raw: body.action.raw,
      known: body.action.known ?? false,
    };
    const evaluationInput: EvaluationInput = {
      mode: body.mode ?? policyRec.mode,
      action,
      authority: body.authority ?? null,
      policy: policyRec.policy,
      frozen: policyRec.frozen,
      estimatedCostUsd: body.estimatedCostUsd ?? 0,
      cumulative: { actionCount: 0, amountMinor: 0, ...(spendSoFarUsd ? { spendSoFarUsd } : {}) },
    };
    const result = evaluateAction(evaluationInput);

    const receipt = await appendReceipt(db, env, {
      workspaceId: body.workspaceId,
      requestId: body.requestId,
      eventType: mapReceiptEvent(result.decision),
      payload: {
        decision: result.decision,
        effectiveDecision: result.effectiveDecision,
        reasons: result.reasons,
        policyVersion: result.policyVersion,
        action: action.name,
        agentId: body.agentId ?? null,
        spendCeilingsUsd: ceilings,
        spendSoFarUsd: spendSoFarUsd ?? null,
        estimatedCostUsd: body.estimatedCostUsd ?? null,
      },
    });

    return Response.json(
      {
        decision: result.decision,
        effectiveDecision: result.effectiveDecision,
        wouldBlock: result.wouldBlock,
        enforced: result.enforced,
        reasons: result.reasons,
        policyVersion: result.policyVersion,
        receipt: {
          id: receipt.id,
          entryHash: receipt.entryHash,
          previousHash: receipt.previousHash,
          signingKeyId: receipt.signingKeyId,
          signature: receipt.signature,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    await captureError(env, err, { route: "POST /v1/evaluate", workspaceId: body.workspaceId });
    return bad("Evaluate failed", 500);
  }
});
