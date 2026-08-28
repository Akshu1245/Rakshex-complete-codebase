#!/usr/bin/env node
/**
 * Explicitly promote an existing local account to the application-level admin role.
 *
 * This helper deliberately does NOT create users, accept passwords on the command
 * line, or change billing entitlements. Create the account through the normal auth
 * flow first, then run this one-off operation from a trusted operator shell.
 *
 * Usage:
 *   RAKSHEX_ADMIN_PROMOTION_CONFIRM=user@example.com \
 *   DATABASE_URL=postgresql://... \
 *   pnpm exec tsx scripts/create-admin.ts user@example.com
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const [, , emailArg] = process.argv;
  if (!emailArg) {
    throw new Error("Usage: pnpm exec tsx scripts/create-admin.ts <existing-account-email>");
  }

  const email = emailArg.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid account email is required");
  }

  const confirmation = process.env.RAKSHEX_ADMIN_PROMOTION_CONFIRM?.trim().toLowerCase();
  if (confirmation !== email) {
    throw new Error(
      "Refusing admin promotion. Set RAKSHEX_ADMIN_PROMOTION_CONFIRM to the exact target email.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!databaseUrl.startsWith("postgres")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: number; email: string | null }>(
      `UPDATE users
       SET role = 'admin', "updatedAt" = now()
       WHERE lower(email) = lower($1)
       RETURNING id, email`,
      [email],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        result.rowCount === 0
          ? `No existing user found for ${email}; create the account through normal auth first.`
          : `Expected one user for ${email}, found ${result.rowCount}.`,
      );
    }

    await client.query("COMMIT");
    console.log(`[create-admin] Promoted existing user id=${result.rows[0]!.id} email=${email}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[create-admin] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
