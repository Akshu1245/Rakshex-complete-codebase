/**
 * Issue #225 / PR #234 — authenticated, tenant-scoped browser API.
 *
 * This is not a login implementation. The auth library's credential-verification
 * integration is still required before PR #234 can be merged as complete.
 *
 * Never accept a user/role/workspace identity from request payloads or headers.
 * Cookies are verified against D1 on every request, including read endpoints.
 * Browser roles may attenuate, but never escalate, the existing membership.
 */
import { readSessionCookie, verifySession, SessionError } from "./session-core.mjs";
import { requireWorkspaceMembership, MembershipAccessError } from "./memberships.mjs";

const PATH = /^\/api\/v1\/control\/browser\/workspaces\/([1-9][0-9]{0,14})\/(me|agents|receipts|keys)$/;
const RANK = Object.freeze({ viewer: 0, member: 1, admin: 2, owner: 3 });

function reply(code, status = 200) {
  return Response.json({ code }, { status, headers: { "cache-control": "no-store" } });
}

function invalid(error) {
  return error instanceof SessionError || error instanceof MembershipAccessError
    ? reply(error.code, error.status)
    : reply("BROWSER_ACCESS_UNAVAILABLE", 503);
}

function sameOriginWrite(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin || origin !== url.origin) return false;
  if (!["same-origin", "none"].includes(request.headers.get("sec-fetch-site") ?? "same-origin"))
    return false;
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    return false;
  return true;
}

async function browserRole(db, workspaceId, subjectId, baseRole) {
  let record;
  try {
    record = await db
      .prepare(
        `SELECT browser_role FROM cf_workspace_memberships
           WHERE workspace_id = ? AND subject_id = ? AND status = 'active'`,
      )
      .bind(workspaceId, subjectId)
      .first();
  } catch {
    throw new MembershipAccessError(503, "MEMBERSHIP_STORE_UNAVAILABLE");
  }
  if (!record || !Object.hasOwn(RANK, baseRole)) {
    throw new MembershipAccessError(403, "WORKSPACE_ACCESS_DENIED");
  }
  const override = record.browser_role ?? baseRole;
  if (!Object.hasOwn(RANK, override)) {
    throw new MembershipAccessError(403, "WORKSPACE_ACCESS_DENIED");
  }
  const effective = Math.min(RANK[baseRole], RANK[override]);
  return Object.keys(RANK).find((role) => RANK[role] === effective);
}

export async function handleBrowserAccess(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/control/browser/")) return null;
  const matched = PATH.exec(url.pathname);
  if (!matched) return reply("NOT_FOUND", 404);
  const [, rawWorkspaceId, resource] = matched;
  const workspaceId = Number(rawWorkspaceId);
  if (!Number.isSafeInteger(workspaceId)) return reply("NOT_FOUND", 404);

  const methods = resource === "me" || resource === "receipts"
    ? ["GET"]
    : resource === "keys"
      ? ["GET", "POST"]
      : ["GET", "POST"];
  if (!methods.includes(request.method)) return reply("METHOD_NOT_ALLOWED", 405);
  if (request.method !== "GET" && !sameOriginWrite(request)) {
    return reply("CSRF_OR_CONTENT_TYPE_DENIED", 403);
  }
  if (!env.DB?.prepare) return reply("DATABASE_UNAVAILABLE", 503);

  try {
    const token = readSessionCookie(request.headers.get("cookie"));
    const session = await verifySession(env.DB, token);
    if (session.workspaceId !== workspaceId) return reply("WORKSPACE_ACCESS_DENIED", 403);
    const membership = await requireWorkspaceMembership(env.DB, {
      subjectId: session.subjectId,
      workspaceId,
    });
    const role = await browserRole(env.DB, workspaceId, session.subjectId, membership.role);
    if (resource === "me") {
      return Response.json(
        { workspaceId, subjectId: session.subjectId, role },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (resource === "receipts" && request.method === "GET") {
      const list = await env.DB
        .prepare(
          "SELECT id,receipt_json FROM cf_receipts WHERE workspace_id=? ORDER BY id DESC LIMIT 50",
        )
        .bind(workspaceId)
        .all();
      return Response.json(
        { receipts: list.results.map((entry) => ({ id: entry.id, ...JSON.parse(entry.receipt_json) })), complete_chain: false },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (resource === "agents" && request.method === "GET") {
      const list = await env.DB
        .prepare("SELECT id,name,status FROM cf_agents WHERE workspace_id=? ORDER BY id DESC LIMIT 100")
        .bind(workspaceId)
        .all();
      return Response.json(
        { agents: list.results },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (resource === "keys" && request.method === "GET") {
      if (RANK[role] < RANK.admin) return reply("WORKSPACE_ROLE_DENIED", 403);
      const list = await env.DB
        .prepare(
          "SELECT id,role,agent_id,revoked_at,created_at FROM cf_api_keys WHERE workspace_id=?",
        )
        .bind(workspaceId)
        .all();
      return Response.json({ keys: list.results }, { headers: { "cache-control": "no-store" } });
    }
    if (RANK[role] < RANK.admin) return reply("WORKSPACE_ROLE_DENIED", 403);
    if (resource === "keys") {
      // Do not expose raw provider / runtime credentials to a browser yet.
      return reply("BROWSER_KEY_ISSUANCE_NOT_MIGRATED", 501);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return reply("INVALID_JSON", 400);
    }
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      typeof input.name !== "string" ||
      input.name.trim().length < 1 ||
      input.name.trim().length > 128
    ) {
      return reply("INVALID_INPUT", 400);
    }
    const id = crypto.randomUUID();
    await env.DB
      .prepare("INSERT INTO cf_agents (id,workspace_id,name) VALUES (?,?,?)")
      .bind(id, workspaceId, input.name.trim())
      .run();
    return Response.json(
      { agentId: id },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return invalid(error);
  }
}
