import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  createSession,
  expiredSessionCookie,
  readSessionCookie,
  revokeSession,
  rotateSession,
  SessionError,
  verifySession,
} from "../../cloudflare/app/session-core.mjs";
import { requireWorkspaceMembership } from "../../cloudflare/app/memberships.mjs";

const CLOCK = new Date("2026-10-14T00:00:00Z");
const LATER = new Date(CLOCK.getTime() + 8 * 60 * 60 * 1000);

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const file of [
    "0001_control_plane.sql",
    "0002_agent_scoped_keys.sql",
    "0003_workspace_memberships.sql",
    "0004_browser_sessions.sql",
  ]) {
    sql.exec(readFileSync("cloudflare/app/migrations/" + file, "utf8"));
  }
  sql.exec(
    "INSERT INTO cf_workspaces (id,name,policy_json) VALUES (1,'A','{}'), (2,'B','{}')",
  );
  sql.exec(
    "INSERT INTO cf_workspace_memberships (workspace_id,subject_id,role) VALUES " +
      "(1,'user-a','owner'),(2,'user-b','admin'),(2,'user-a','member')",
  );
  return {
    sql,
    db: {
      prepare(query) {
        let args = [];
        return {
          bind(...values) {
            args = values;
            return this;
          },
          async first() {
            return sql.prepare(query).get(...args) ?? null;
          },
          async run() {
            return { meta: sql.prepare(query).run(...args) };
          },
        };
      },
    },
  };
}
const identity = (subjectId, workspaceId) => ({
  subjectId,
  workspaceId,
  verifiedByAuthAdapter: true,
});

async function rejects(work, status, code) {
  await assert.rejects(
    work,
    (error) => error instanceof SessionError && error.status === status && error.code === code,
  );
}

test("hashed D1 session storage and safe cookie attributes", async () => {
  const { sql, db } = fixture();
  const created = await createSession(db, identity("user-a", 1), CLOCK);
  assert.match(created.token, /^rkh_s_[A-Za-z0-9_-]{43}$/);
  assert.match(created.setCookie, /^__Host-rakshex_session=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=28800"]) {
    assert.ok(created.setCookie.includes(flag), flag);
  }
  assert.equal(readSessionCookie(created.setCookie), created.token);
  const row = sql.prepare("SELECT * FROM cf_browser_sessions").get();
  assert.match(row.token_hash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes(created.token));
  assert.equal(row.workspace_id, 1);
  assert.equal(row.subject_id, "user-a");
  assert.deepEqual(
    await verifySession(db, created.token, CLOCK),
    { subjectId: "user-a", workspaceId: 1, role: "owner", membershipRevision: 1 },
  );
  assert.match(expiredSessionCookie(), /Max-Age=0/);
});

test("expired, revoked and tampered sessions deny on the next read", async () => {
  const { db } = fixture();
  const created = await createSession(db, identity("user-a", 1), CLOCK);
  await rejects(verifySession(db, created.token, LATER), 401, "SESSION_INVALID");
  await rejects(
    verifySession(db, created.token.slice(0, -1) + "!", CLOCK),
    401,
    "SESSION_INVALID",
  );
  assert.equal(await revokeSession(db, created.token, CLOCK), true);
  assert.equal(await revokeSession(db, created.token, CLOCK), false);
  await rejects(verifySession(db, created.token, CLOCK), 401, "SESSION_INVALID");
});

test("duplicate cookies, forged format and absent cookies deny", () => {
  const legit = "rkh_s_" + "a".repeat(43);
  assert.throws(() => readSessionCookie("other=value"), /SESSION_INVALID/);
  assert.throws(
    () => readSessionCookie("__Host-rakshex_session=" + legit + "; __Host-rakshex_session=" + legit),
    /SESSION_INVALID/,
  );
  assert.throws(() => readSessionCookie("__Host-rakshex_session=" + legit + "%3B"), /SESSION_INVALID/);
  assert.throws(() => readSessionCookie("x".repeat(9000)), /SESSION_INVALID/);
});

test("workspace A token cannot be rotated into B and cannot authorize B", async () => {
  const { db } = fixture();
  const created = await createSession(db, identity("user-a", 1), CLOCK);
  const claims = await verifySession(db, created.token, CLOCK);
  await assert.rejects(
    requireWorkspaceMembership(db, {
      workspaceId: 2,
      subjectId: claims.subjectId,
      minRole: "admin",
    }),
    (e) => e.status === 403,
  );
  await rejects(
    rotateSession(db, created.token, identity("user-a", 2), CLOCK),
    401,
    "SESSION_INVALID",
  );
  assert.equal((await verifySession(db, created.token, CLOCK)).workspaceId, 1);
});

test("privilege change revokes old membership-bound token; verified rotation issues new one", async () => {
  const { sql, db } = fixture();
  const original = await createSession(db, identity("user-a", 1), CLOCK);
  sql.exec(
    "UPDATE cf_workspace_memberships SET role='member',revision=revision+1 " +
      "WHERE workspace_id=1 AND subject_id='user-a'",
  );
  await rejects(verifySession(db, original.token, CLOCK), 401, "SESSION_INVALID");
  const replacement = await rotateSession(db, original.token, identity("user-a", 1), CLOCK);
  assert.notEqual(original.token, replacement.token);
  await rejects(verifySession(db, original.token, CLOCK), 401, "SESSION_INVALID");
  assert.equal((await verifySession(db, replacement.token, CLOCK)).role, "member");
});

test("revoked membership and unavailable database cannot grant a session", async () => {
  const { sql, db } = fixture();
  const current = await createSession(db, identity("user-a", 1), CLOCK);
  sql.exec(
    "UPDATE cf_workspace_memberships SET status='revoked',revoked_at=CURRENT_TIMESTAMP," +
      "revision=revision+1 WHERE workspace_id=1 AND subject_id='user-a'",
  );
  await rejects(verifySession(db, current.token, CLOCK), 401, "SESSION_INVALID");
  await rejects(createSession(db, identity("user-a", 1), CLOCK), 403, "MEMBERSHIP_REQUIRED");
  await rejects(verifySession(null, current.token, CLOCK), 503, "SESSION_STORE_UNAVAILABLE");
  await rejects(
    createSession(
      { prepare() { throw Error("database unavailable"); } },
      identity("user-b", 2),
      CLOCK,
    ),
    503,
    "SESSION_STORE_UNAVAILABLE",
  );
});

test("no cookie/session issuance from unverified or invalid identity", async () => {
  const { db, sql } = fixture();
  await rejects(createSession(db, { subjectId: "user-a", workspaceId: 1 }, CLOCK), 401, "VERIFIED_IDENTITY_REQUIRED");
  await rejects(createSession(db, identity("user-a", 0), CLOCK), 401, "VERIFIED_IDENTITY_REQUIRED");
  assert.equal(sql.prepare("SELECT COUNT(*) AS count FROM cf_browser_sessions").get().count, 0);
});
