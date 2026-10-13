import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  MembershipAccessError,
  requireWorkspaceMembership,
} from "../../cloudflare/app/memberships.mjs";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const migration of [
    "0001_control_plane.sql",
    "0002_agent_scoped_keys.sql",
    "0003_workspace_memberships.sql",
  ]) {
    sql.exec(readFileSync("cloudflare/app/migrations/" + migration, "utf8"));
  }
  sql.exec(
    "INSERT INTO cf_workspaces (id, name, policy_json) VALUES (1, 'A', '{}'), (2, 'B', '{}')",
  );
  const db = {
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
      };
    },
  };
  function grant(workspaceId, subjectId, role = "member") {
    sql
      .prepare(
        "INSERT INTO cf_workspace_memberships (workspace_id, subject_id, role) VALUES (?, ?, ?)",
      )
      .run(workspaceId, subjectId, role);
  }
  return { sql, db, grant };
}
async function denied(work, status, code) {
  await assert.rejects(
    work,
    (err) =>
      err instanceof MembershipAccessError && err.status === status && err.code === code,
  );
}

test("member, admin and owner grant the minimum requested role only", async () => {
  const { db, grant } = fixture();
  grant(1, "member-1", "member");
  grant(1, "admin-1", "admin");
  grant(1, "owner-1", "owner");
  assert.equal((await requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "member-1" })).role, "member");
  assert.equal((await requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "admin-1", minRole: "admin" })).role, "admin");
  assert.equal((await requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "owner-1", minRole: "owner" })).role, "owner");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "member-1", minRole: "admin" }), 403, "WORKSPACE_ACCESS_DENIED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "admin-1", minRole: "owner" }), 403, "WORKSPACE_ACCESS_DENIED");
});

test("one workspace cannot borrow another workspace membership or an admin role", async () => {
  const { db, grant } = fixture();
  grant(1, "user-1", "owner");
  grant(2, "user-2", "admin");
  await denied(requireWorkspaceMembership(db, { workspaceId: 2, subjectId: "user-1" }), 403, "WORKSPACE_ACCESS_DENIED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "user-2" }), 403, "WORKSPACE_ACCESS_DENIED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "' OR 1=1 --" }), 403, "WORKSPACE_ACCESS_DENIED");
});

test("missing identity, membership and unsupported role fail closed", async () => {
  const { db } = fixture();
  await denied(requireWorkspaceMembership(db, { workspaceId: 1 }), 401, "VERIFIED_SESSION_REQUIRED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "" }), 401, "VERIFIED_SESSION_REQUIRED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "someone" }), 403, "WORKSPACE_ACCESS_DENIED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 0, subjectId: "someone" }), 403, "WORKSPACE_ACCESS_DENIED");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "someone", minRole: "superadmin" }), 403, "WORKSPACE_ACCESS_DENIED");
});

test("revoked memberships and missing database cannot authorize", async () => {
  const { db, sql, grant } = fixture();
  grant(1, "user-1", "owner");
  assert.equal((await requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "user-1" })).role, "owner");
  sql.exec("UPDATE cf_workspace_memberships SET status='revoked', revoked_at=CURRENT_TIMESTAMP, revision=revision+1 WHERE workspace_id=1 AND subject_id='user-1'");
  await denied(requireWorkspaceMembership(db, { workspaceId: 1, subjectId: "user-1" }), 403, "WORKSPACE_ACCESS_DENIED");
  await denied(requireWorkspaceMembership(null, { workspaceId: 1, subjectId: "user-1" }), 503, "MEMBERSHIP_STORE_UNAVAILABLE");
  await denied(requireWorkspaceMembership({ prepare() { throw Error("offline") } }, { workspaceId: 1, subjectId: "user-1" }), 503, "MEMBERSHIP_STORE_UNAVAILABLE");
});

test("membership schema enforces roles, tenancy references and revocation consistency", () => {
  const { sql, grant } = fixture();
  grant(1, "user-1", "member");
  assert.throws(() => grant(3, "user-2"), /FOREIGN KEY/);
  assert.throws(() => grant(1, "bad-role", "root"), /CHECK/);
  assert.throws(() => sql.exec("UPDATE cf_workspace_memberships SET status='revoked' WHERE subject_id='user-1'"), /CHECK/);
  assert.throws(() => grant(1, "user-1"), /UNIQUE/);
});
