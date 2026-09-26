import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "./_lib";

/**
 * Read a worker env var, falling back to process.env for local dev.
 * Server-only: never import from client components.
 */
export async function readWorkerEnv(key: string): Promise<string | undefined> {
  try {
    const { env } = await getCloudflareContext();
    const fromWorker = (env as unknown as Record<string, string | undefined>)[key];
    if (fromWorker) return fromWorker;
  } catch {
    // Not on the Cloudflare runtime (local dev / tests) — fall through.
  }
  return process.env[key];
}

/**
 * Server-only admin gate shared by the /api/admin routes and the
 * /admin layout. Reads ADMIN_EMAILS (comma-separated).
 */
export async function readAdminEmails(): Promise<string | undefined> {
  return readWorkerEnv("ADMIN_EMAILS");
}

export type AdminGate = { email: string } | { response: NextResponse };

/**
 * Require a signed-in admin session. Returns the admin's email, or a
 * 401/403 JSON response to return directly. The email check is the web
 * tier's gate; the firewall worker re-checks ADMIN_API_KEY on every call.
 */
export async function requireAdminSession(): Promise<AdminGate> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      response: NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 }),
    };
  }
  const email = session.user.email ?? null;
  if (!isAdminEmail(email, await readAdminEmails())) {
    return {
      response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { email: email as string };
}
