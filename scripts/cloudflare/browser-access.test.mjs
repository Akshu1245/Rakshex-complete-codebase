import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleBrowserAccess } from "../../cloudflare/app/browser-access.mjs";
import { createSession, revokeSession } from "../../cloudflare/app/session-core.mjs";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  for (const filename of [
    "0001_control_plane.sql",
    "0002_agent_scoped_keys.sql",
    "0003_workspace_memberships.sql",
    "0004_browser_sessions.sql",
    "0005_browser_roles.sql",
  ]) {
    sql.exec(readFileSync("cloudflare/app/migrations/" + filename, "utf8"));
  }
  sql.exec("INSERT INTO cf_workspaces (id,name,policy_json) VALUES (1,'A','{}'),(2,'B','{}')");
  sql.exec(
    "INSERT INTO cf_workspace_memberships (workspace_id,subject_id,role) VALUES " +
      "(1,'alice','owner'),(2,'bob','owner'),(1,'view','member'),(1,'member','member')",
  );
  sql.exec(
    "UPDATE cf_workspace_memberships SET browser_role='viewer' " +
      "WHERE workspace_id=1 AND subject_id='view'",
  );
  const DB = {
    prepare(query) {
      let params = [];
      return {
        bind(...args) {
          params = args;
          return this;
        },
        async first() {
          return sql.prepare(query).get(...params) ?? null;
        },
        async all() {
          return { results: sql.prepare(query).all(...params) };
        },
        async run() {
          return { meta: sql.prepare(query).run(...params) };
        },
      };
    },
  };
  const env = { DB };
  async function cookie(name, workspaceId) {
    return (
      await createSession(DB, {
        verifiedByAuthAdapter: true,
        subjectId: name,
        workspaceId,
      })
    ).setCookie.split(";")[0];
  }
  async function request(workspaceId, resource, opts = {}) {
    const url = "https://app.example/api/v1/control/browser/workspaces/" + workspaceId + "/" + resource;
    const response = await handleBrowserAccess(
      new Request(url, {
        method: opts.method ?? "GET",
        headers: {
          ...(opts.cookie ? { cookie: opts.cookie } : {}),
          ...(opts.origin ? { origin: opts.origin } : {}),
          ...(opts.body ? { "content-type": "application/json" } : {}),
          ...(opts.headers ?? {}),
        },
        ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      }),
      env,
    );
    return { status: response.status, body: await response.json() };
  }
  return { sql, env, DB, request, cookie };
}

test("no session, invalid cookie and unavailable D1 always fail closed", async () => {
  const f = fixture();
  assert.equal((await f.request(1, "agents")).status, 401);
  assert.equal((await f.request(1, "agents", { cookie: "__Host-rakshex_session=rkh_s_fake" })).status, 401);
  const c = await f.cookie("alice", 1);
  f.env.DB = null;
  assert.equal((await f.request(1, "agents", { cookie: c })).status, 503);
});

test("authenticated workspace owner can read only own workspace", async () => {
  const f = fixture();
  const alice = await f.cookie("alice", 1);
  const bob = await f.cookie("bob", 2);
  assert.equal((await f.request(1, "me", { cookie: alice })).body.role, "owner");
  assert.equal((await f.request(2, "me", { cookie: bob })).body.role, "owner");
  assert.equal((await f.request(2, "agents", { cookie: alice })).status, 403);
  assert.equal((await f.request(1, "receipts", { cookie: bob })).status, 403);
  assert.equal((await f.request(2, "keys", { cookie: alice })).status, 403);
  assert.equal((await f.request(2, "agents", {
    cookie: alice,
    method: "POST",
    origin: "https://app.example",
    body: { name: "stolen", workspaceId: 2 },
  })).status, 403);
});

test("viewer cannot create keys or agents; member cannot create keys or cross tenants", async () => {
  const f = fixture();
  const viewer = await f.cookie("view", 1);
  const member = await f.cookie("member", 1);
  assert.equal((await f.request(1, "me", { cookie: viewer })).body.role, "viewer");
  assert.equal((await f.request(1, "keys", { cookie: viewer })).status, 403);
  assert.equal((await f.request(1, "keys", {
    cookie: viewer,
    method: "POST",
    origin: "https://app.example",
    body: { role: "runtime" },
  })).status, 403);
  assert.equal((await f.request(1, "agents", {
    cookie: viewer,
    method: "POST",
    origin: "https://app.example",
    body: { name: "not allowed" },
  })).status, 403);
  assert.equal((await f.request(1, "keys", { cookie: member })).status, 403);
  assert.equal((await f.request(2, "agents", { cookie: member })).status, 403);
});

test("strict Origin and Fetch Metadata protection prevents CSRF on browser writes", async () => {
  const f = fixture();
  const cookie = await f.cookie("alice", 1);
  const make = (origin, headers = {}) =>
    f.request(1, "agents", {
      cookie,
      method: "POST",
      origin,
      headers,
      body: { name: "agent" },
    });
  assert.equal((await make("https://evil.example")).status, 403);
  assert.equal((await make(undefined)).status, 403);
  assert.equal(
    (await make("https://app.example", { "sec-fetch-site": "cross-site" })).status,
    403,
  );
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_agents").get().n, 0);
  assert.equal((await make("https://app.example")).status, 201);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_agents WHERE workspace_id=1").get().n, 1);
});

test("browser API rejects body-based tenant switching and never issues runtime keys", async () => {
  const f = fixture();
  const cookie = await f.cookie("alice", 1);
  assert.equal(
    (await f.request(1, "agents", {
      cookie,
      method: "POST",
      origin: "https://app.example",
      body: { name: "agent", workspaceId: 2 },
    })).status,
    400,
  );
  assert.equal(
    (await f.request(1, "keys", {
      cookie,
      method: "POST",
      origin: "https://app.example",
      body: { role: "runtime" },
    })).status,
    501,
  );
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_api_keys").get().n, 0);
});

test("revoked session and downgraded membership deny immediately", async () => {
  const f = fixture();
  const issued = await createSession(f.DB, {
    verifiedByAuthAdapter: true,
    subjectId: "alice",
    workspaceId: 1,
  });
  const cookie = issued.setCookie.split(";")[0];
  assert.equal((await f.request(1, "me", { cookie })).status, 200);
  await revokeSession(f.DB, issued.token);
  assert.equal((await f.request(1, "me", { cookie })).status, 401);
  const newCookie = await f.cookie("alice", 1);
  f.sql.exec(
    "UPDATE cf_workspace_memberships SET role='member',revision=revision+1 " +
      "WHERE workspace_id=1 AND subject_id='alice'",
  );
  assert.equal((await f.request(1, "me", { cookie: newCookie })).status, 401);
});

test("browser privilege override never escalates above membership role", async () => {
  const f = fixture();
  f.sql.exec(
    "UPDATE cf_workspace_memberships SET browser_role='owner' " +
      "WHERE workspace_id=1 AND subject_id='member'",
  );
  const c = await f.cookie("member", 1);
  assert.equal((await f.request(1, "me", { cookie: c })).body.role, "member");
  assert.equal((await f.request(1, "keys", { cookie: c })).status, 403);
});
