import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb } from "../db";
import type { Env } from "../env";

export const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const env = c.env;
  const started = Date.now();
  let dbOk = false;
  try {
    const db = createDb(env);
    await db.run(sql`SELECT 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const body = {
    ok: dbOk,
    service: "rakshex-firewall-workers",
    environment: env.ENVIRONMENT ?? "production",
    latencyMs: Date.now() - started,
  };
  return Response.json(body, { status: dbOk ? 200 : 503 });
});
