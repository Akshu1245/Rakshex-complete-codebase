import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, verify, createHash } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
const dir = mkdtempSync(join(tmpdir(), "rakshex-app-test-"));
buildSync({
  entryPoints: ["cloudflare/app/worker.mjs"],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: join(dir, "worker.mjs"),
});
const { default: worker } = await import(pathToFileURL(join(dir, "worker.mjs")).href);
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  sql.exec(readFileSync("cloudflare/app/migrations/0001_control_plane.sql", "utf8"));
  sql.exec(readFileSync("cloudflare/app/migrations/0002_agent_scoped_keys.sql", "utf8"));
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
        async batchExecute() {
          if (/RETURNING/i.test(query)) return { results: sql.prepare(query).all(...params) };
          return { meta: sql.prepare(query).run(...params) };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.batchExecute());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = {
    DB,
    ADMIN_BOOTSTRAP_KEY: "test-admin-".repeat(4),
    RECEIPT_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    RECEIPT_PUBLIC_PEM: publicKey.export({ type: "spki", format: "pem" }).toString(),
    RECEIPT_KEY_ID: "fixture-key",
  };
  async function call(path, method = "GET", input, key) {
    const r = await worker.fetch(
      new Request("https://app/api/v1/control" + path, {
        method,
        headers: {
          ...(input ? { "content-type": "application/json" } : {}),
          ...(key ? { authorization: "Bearer " + key } : {}),
        },
        ...(input ? { body: JSON.stringify(input) } : {}),
      }),
      env,
    );
    return { status: r.status, body: await r.json() };
  }
  return { sql, env, call };
}
async function setup(f, name = "fixture", maxCount = 10) {
  const w = await f.call("/bootstrap", "POST", { name }, f.env.ADMIN_BOOTSTRAP_KEY);
  assert.equal(w.status, 201);
  const key = w.body.apiKey;
  const a = await f.call("/agents", "POST", { name: "test agent" }, key);
  const scope = { actions: ["database.read"], maxCount };
  const grant = await f.call("/authorities", "POST", { agentId: a.body.agentId, scope }, key);
  assert.equal(grant.status, 201);
  return {
    key,
    workspaceId: w.body.workspaceId,
    agentId: a.body.agentId,
    authorityId: grant.body.authorityId,
  };
}
function action(s, id = "request-1", sql = "SELECT 1") {
  return {
    requestId: id,
    agentId: s.agentId,
    authorityId: s.authorityId,
    action: { provider: "postgres", operation: "query", parameters: { sql } },
  };
}
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === "object")
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .map((k) => [k, canonical(x[k])]),
    );
  return x;
}
test("real SQLite onboarding, scoped authority and signed durable receipt", async () => {
  const f = fixture();
  const s = await setup(f);
  const r = await f.call("/authorize", "POST", action(s), s.key);
  assert.equal(r.status, 200);
  const receipt = r.body.receipt;
  assert.equal(receipt.payload.effectiveDecision, "ALLOW");
  const { entryHash, signature, publicKeyPem, signingAlgorithm, signingKeyId, ...material } =
    receipt;
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(canonical(material)))
      .digest("hex"),
    entryHash,
  );
  assert.equal(
    verify(null, Buffer.from(entryHash, "hex"), publicKey, Buffer.from(signature, "base64")),
    true,
  );
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_receipts").get().n, 1);
});
test("destructive CTE is durably denied under read authority", async () => {
  const f = fixture();
  const s = await setup(f);
  const r = await f.call(
    "/authorize",
    "POST",
    action(s, "cte", "WITH d AS (DELETE FROM accounts RETURNING *) SELECT * FROM d"),
    s.key,
  );
  assert.equal(r.body.receipt.payload.effectiveDecision, "DENY");
  assert.equal(r.body.receipt.payload.semanticAction, "database.delete");
});
test("identical retry returns same evidence; changed input conflicts", async () => {
  const f = fixture();
  const s = await setup(f);
  const a = await f.call("/authorize", "POST", action(s), s.key);
  const b = await f.call("/authorize", "POST", action(s), s.key);
  assert.equal(b.body.replayed, true);
  assert.equal(a.body.receipt.entryHash, b.body.receipt.entryHash);
  assert.equal(
    (await f.call("/authorize", "POST", action(s, "request-1", "SELECT 2"), s.key)).status,
    409,
  );
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_receipts").get().n, 1);
});
test("cross-workspace resource substitution cannot authorize or leak receipts", async () => {
  const f = fixture();
  const a = await setup(f, "a");
  const b = await setup(f, "b");
  const r = await f.call("/authorize", "POST", action(b), a.key);
  assert.equal(r.body.receipt.payload.effectiveDecision, "DENY");
  assert.equal((await f.call("/receipts", "GET", null, b.key)).body.receipts.length, 0);
  assert.equal(
    (await f.call("/authorities/" + b.authorityId + "/revoke", "POST", null, a.key)).status,
    404,
  );
});
test("revocation and workspace freeze apply on the next authorization", async () => {
  const f = fixture();
  const s = await setup(f);
  assert.equal((await f.call("/freeze", "POST", { frozen: true }, s.key)).status, 200);
  assert.equal(
    (await f.call("/authorize", "POST", action(s, "frozen"), s.key)).body.receipt.payload.decision,
    "FREEZE",
  );
  await f.call("/freeze", "POST", { frozen: false }, s.key);
  await f.call("/authorities/" + s.authorityId + "/revoke", "POST", null, s.key);
  assert.equal(
    (await f.call("/authorize", "POST", action(s, "revoked"), s.key)).body.receipt.payload
      .effectiveDecision,
    "DENY",
  );
});
test("concurrent authorizations cannot exceed stored authority maxCount or fork chain", async () => {
  const f = fixture();
  const s = await setup(f, "race", 2);
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      f.call("/authorize", "POST", action(s, "race-" + i), s.key),
    ),
  );
  assert.equal(
    results.filter((r) => r.body.receipt?.payload.effectiveDecision === "ALLOW").length,
    2,
  );
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM cf_receipts WHERE event_type='allow'").get().n,
    2,
  );
  const rows = f.sql.prepare("SELECT entry_hash,previous_hash FROM cf_receipts ORDER BY id").all();
  for (let i = 0; i < rows.length; i++)
    assert.equal(rows[i].previous_hash, i ? rows[i - 1].entry_hash : "0".repeat(64));
});
test("runtime/read keys cannot administer and revoked keys fail authentication", async () => {
  const f = fixture();
  const s = await setup(f);
  const k = await f.call("/keys", "POST", { role: "runtime", agentId: s.agentId }, s.key);
  assert.equal(k.status, 201);
  assert.equal((await f.call("/policy", "PUT", { version: "x" }, k.body.apiKey)).status, 403);
  await f.call("/keys/" + k.body.keyId + "/revoke", "POST", null, s.key);
  assert.equal((await f.call("/workspace", "GET", null, k.body.apiKey)).status, 401);
});
test("404,405,400 and database/signing failures are explicit", async () => {
  const f = fixture();
  assert.equal((await f.call("/missing")).status, 404);
  assert.equal((await f.call("/bootstrap", "GET")).status, 405);
  const s = await setup(f);
  assert.equal(
    (await f.call("/authorize", "POST", { ...action(s), workspaceId: 999 }, s.key)).status,
    400,
  );
  delete f.env.RECEIPT_PRIVATE_KEY;
  assert.equal((await f.call("/authorize", "POST", action(s), s.key)).status, 503);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_receipts").get().n, 0);
  f.env.DB = null;
  assert.equal((await f.call("/workspace", "GET", null, s.key)).status, 503);
});
test("receipt store rejects modification and deletion", async () => {
  const f = fixture();
  const s = await setup(f);
  await f.call("/authorize", "POST", action(s), s.key);
  assert.throws(() => f.sql.exec("DELETE FROM cf_receipts"), /append-only/);
  assert.throws(() => f.sql.exec("UPDATE cf_receipts SET decision='ALLOW'"), /append-only/);
});

test("revocation racing the final insert forces a fresh denial", async () => {
  const f = fixture();
  const s = await setup(f);
  const prepare = f.env.DB.prepare.bind(f.env.DB);
  let changed = false;
  f.env.DB.prepare = (sql) => {
    if (sql.startsWith("INSERT INTO cf_receipts") && !changed) {
      changed = true;
      f.sql.prepare("UPDATE cf_authorities SET status='revoked' WHERE id=?").run(s.authorityId);
    }
    return prepare(sql);
  };
  const r = await f.call("/authorize", "POST", action(s, "revocation-race"), s.key);
  assert.equal(r.status, 200);
  assert.equal(r.body.receipt.payload.effectiveDecision, "DENY");
  assert.equal(
    f.sql.prepare("SELECT COUNT(*) AS n FROM cf_receipts WHERE event_type='allow'").get().n,
    0,
  );
});
test("key revocation racing receipt insertion cannot return ALLOW", async () => {
  const f = fixture();
  const s = await setup(f);
  const prepare = f.env.DB.prepare.bind(f.env.DB);
  let changed = false;
  f.env.DB.prepare = (sql) => {
    if (sql.startsWith("INSERT INTO cf_receipts") && !changed) {
      changed = true;
      f.sql
        .prepare("UPDATE cf_api_keys SET revoked_at=CURRENT_TIMESTAMP WHERE workspace_id=?")
        .run(s.workspaceId);
    }
    return prepare(sql);
  };
  assert.equal((await f.call("/authorize", "POST", action(s, "key-race"), s.key)).status, 401);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM cf_receipts").get().n, 0);
});

test("runtime keys are agent-bound and cannot inspect or authorize another agent", async () => {
  const f = fixture();
  const a = await setup(f);
  const other = await f.call("/agents", "POST", { name: "another agent" }, a.key);
  const grant = await f.call(
    "/authorities",
    "POST",
    { agentId: other.body.agentId, scope: { actions: ["database.read"] } },
    a.key,
  );
  assert.equal((await f.call("/keys", "POST", { role: "runtime" }, a.key)).status, 400);
  assert.equal(
    (await f.call("/keys", "POST", { role: "runtime", agentId: "missing" }, a.key)).status,
    404,
  );
  const runtime = await f.call("/keys", "POST", { role: "runtime", agentId: a.agentId }, a.key);
  assert.equal(runtime.status, 201);
  const proposal = {
    ...action(a, "agent-scope"),
    agentId: other.body.agentId,
    authorityId: grant.body.authorityId,
  };
  assert.equal((await f.call("/authorize", "POST", proposal, runtime.body.apiKey)).status, 403);
  await f.call("/authorize", "POST", proposal, a.key);
  assert.equal(
    (await f.call("/receipts", "GET", null, runtime.body.apiKey)).body.receipts.length,
    0,
  );
  assert.equal(
    (await f.call("/authorize", "POST", action(a, "own-agent"), runtime.body.apiKey)).body.receipt
      .payload.effectiveDecision,
    "ALLOW",
  );
});
