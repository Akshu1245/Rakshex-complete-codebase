/**
 * Ledger fork-safety regression test (no live Postgres required).
 *
 * The action_ledger hash chain is only tamper-evident if every append for a
 * workspace serializes the unit: read-previous-hash -> insert record ->
 * insert approval. This test drives the real `evaluate` mutation against a
 * statement-recording fake drizzle DB and asserts that:
 *
 *   1. the chain-append unit runs inside a transaction;
 *   2. the FIRST statement inside that transaction is
 *      `SELECT pg_advisory_xact_lock(<workspaceId>::bigint)`;
 *   3. the previous-hash read and both inserts happen after the lock,
 *      inside the same transaction — so two concurrent evaluates cannot
 *      read the same previousHash and fork the chain.
 *
 * A true concurrency test needs Postgres; this pins the serialization
 * mechanism instead, and fails if the lock is removed or reordered.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "../utils/security";
import {
  actionApprovals,
  actionLedger,
  agentIdentities,
  delegatedAuthorities,
} from "@rakshex/database";

vi.mock("../db", () => ({
  getDb: vi.fn(),
  createAuditLogEntry: vi.fn(async () => undefined),
}));
vi.mock("../services/authorization", () => ({
  requireWorkspaceMembership: vi.fn(async () => undefined),
  requireWorkspacePermission: vi.fn(async () => undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { getDb } from "../db";
import { agentFirewallRouter } from "./agentFirewall";

const WORKSPACE_ID = 42;

const statements: string[] = [];

const AGENT_ROW = {
  id: "agt_test",
  environment: "production",
  mode: "enforce",
  status: "active",
  ownerUserId: 7,
  policyConfig: null,
};
const AUTHORITY_ROW = {
  id: "authz_test",
  principalUserId: 7,
  scope: { actions: ["code.merge"] },
};

function tableName(table: unknown): string {
  if (table === actionLedger) return "action_ledger";
  if (table === actionApprovals) return "action_approvals";
  if (table === agentIdentities) return "agent_identities";
  if (table === delegatedAuthorities) return "delegated_authorities";
  return "unknown_table";
}

/** Render a drizzle `sql` template (with bound params) back to readable text. */
function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] } | null)?.queryChunks;
  if (!Array.isArray(chunks)) return String(query);
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      if (chunk && typeof chunk === "object" && "value" in chunk) {
        // StringChunk carries its literal text in `.value` (string[]).
        const v = (chunk as { value: unknown }).value;
        if (Array.isArray(v)) return v.join("");
      }
      // Bound params arrive as raw values (e.g. the workspace id number).
      return `<param:${JSON.stringify(chunk && typeof chunk === "object" && "value" in chunk ? (chunk as { value: unknown }).value : chunk)}>`;
    })
    .join("");
}

function selectChain(inTx: boolean, cols?: Record<string, unknown>) {
  let table: unknown;
  const self: Record<string, unknown> = {
    from(t: unknown) {
      table = t;
      return self;
    },
    where() {
      return self;
    },
    orderBy() {
      return self;
    },
    limit() {
      return self;
    },
    then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
      const scope = inTx ? "tx" : "db";
      let label: string;
      let value: unknown = [];
      if (table === actionLedger && cols && "recordHash" in cols) {
        label = `${scope}:select previous_hash from action_ledger`;
      } else if (table === actionLedger && !cols) {
        label = `${scope}:select idempotency_check from action_ledger`;
      } else if (table === agentIdentities) {
        label = `${scope}:select agent`;
        value = [AGENT_ROW];
      } else if (table === delegatedAuthorities) {
        label = `${scope}:select authority`;
        value = [AUTHORITY_ROW];
      } else if (table === actionLedger) {
        label = `${scope}:select recent_actions from action_ledger`;
      } else {
        label = `${scope}:select from ${tableName(table)}`;
      }
      statements.push(label);
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return self;
}

function insertChain(inTx: boolean, table: unknown) {
  const self: Record<string, unknown> = {
    values() {
      statements.push(`${inTx ? "tx" : "db"}:insert into ${tableName(table)}`);
      return self;
    },
    returning() {
      return self;
    },
    then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
      return Promise.resolve([]).then(resolve, reject);
    },
  };
  return self;
}

function updateChain(inTx: boolean, table: unknown) {
  const self: Record<string, unknown> = {
    set() {
      return self;
    },
    where() {
      statements.push(`${inTx ? "tx" : "db"}:update ${tableName(table)}`);
      return self;
    },
    then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
      return Promise.resolve([]).then(resolve, reject);
    },
  };
  return self;
}

function makeDb(inTx: boolean) {
  return {
    select: (cols?: Record<string, unknown>) => selectChain(inTx, cols),
    insert: (table: unknown) => insertChain(inTx, table),
    update: (table: unknown) => updateChain(inTx, table),
    execute: (query: unknown) => {
      statements.push(`tx:execute ${sqlText(query)}`);
      return Promise.resolve({ rows: [] });
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      statements.push("begin transaction");
      try {
        const result = await fn(makeDb(true));
        statements.push("commit");
        return result;
      } catch (error) {
        statements.push("rollback");
        throw error;
      }
    },
  };
}

function ctxFor(uid: number) {
  // Same CSRF-passing shape the e2e tests use for createCaller.
  const csrfToken = generateCsrfToken();
  return {
    user: {
      id: uid,
      openId: `local:lock-test-${uid}`,
      email: "lock-test@example.com",
      name: "LockTest",
      role: "admin",
      plan: "free",
    },
    req: {
      protocol: "https",
      headers: {
        cookie: `csrf-token=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
      ip: "127.0.0.1",
    },
    res: { clearCookie: () => undefined, getHeader: () => undefined, cookie: () => undefined },
  } as never;
}

beforeEach(() => {
  statements.length = 0;
  vi.mocked(getDb).mockResolvedValue(makeDb(false) as never);
});

describe("evaluate ledger fork-safety", () => {
  it("serializes the chain-append unit under a per-workspace advisory lock", async () => {
    const caller = agentFirewallRouter.createCaller(ctxFor(7));
    const result = (await caller.evaluate({
      workspaceId: WORKSPACE_ID,
      agentId: "agt_test",
      authorityId: "authz_test",
      idempotencyKey: "idem-lock-test-001",
      provider: "github",
      operation: "pulls.merge",
      parameters: {},
    })) as { decision: string; ledgerId: string; approvalId?: string; replayed: boolean };

    // Sanity: the fixture action (code.merge) hits APPROVAL_REQUIRED under
    // the default policy, so the approval insert is part of the unit too.
    expect(result.replayed).toBe(false);
    expect(result.decision).toBe("APPROVAL_REQUIRED");
    expect(result.ledgerId).toMatch(/^act_/);
    expect(result.approvalId).toMatch(/^apr_/);

    const beginIdx = statements.indexOf("begin transaction");
    expect(beginIdx).toBeGreaterThan(-1);

    const inTx = statements.slice(beginIdx);
    // 1. The FIRST statement in the transaction is the advisory lock.
    expect(inTx[1]).toContain("pg_advisory_xact_lock");
    expect(inTx[1]).toContain(`<param:${WORKSPACE_ID}>`);

    // 2. Lock -> previous-hash read -> ledger insert -> approval insert,
    //    all inside the same transaction, in that order.
    const order = [
      "tx:execute",
      "tx:select previous_hash from action_ledger",
      "tx:insert into action_ledger",
      "tx:insert into action_approvals",
    ];
    let cursor = 0;
    for (const label of order) {
      const idx = inTx.findIndex((s, i) => i >= cursor && s.startsWith(label));
      expect(idx, `expected "${label}" after position ${cursor} in ${JSON.stringify(inTx)}`).toBeGreaterThan(-1);
      cursor = idx + 1;
    }

    // 3. Nothing touches the ledger chain outside the transaction.
    const outside = statements.slice(0, beginIdx);
    expect(outside.some((s) => s.includes("previous_hash"))).toBe(false);
    expect(outside.some((s) => s.includes("insert into action_ledger"))).toBe(false);
    expect(outside.some((s) => s.includes("insert into action_approvals"))).toBe(false);
  });
});
