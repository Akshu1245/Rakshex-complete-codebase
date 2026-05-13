#!/usr/bin/env node
/**
 * One-off CLI to promote (or create) an admin user.
 *
 * Usage:
 *   node --loader tsx scripts/create-admin.ts <email> [name] [password]
 *
 * - If the user already exists, their role is set to "admin".
 * - If the user doesn't exist and a password is provided, a new account is
 *   created with role=admin, plan=enterprise, and PBKDF2-hashed password.
 * - If the user doesn't exist and no password is provided, the script exits
 *   with an error (we refuse to create passwordless accounts).
 *
 * Environment:
 *   DATABASE_URL must point at a MySQL instance with the current schema.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import * as db from "../server/db";
import { users } from "../drizzle/schema";
import { hashPassword } from "../server/utils/password";

async function main() {
  const [, , emailArg, nameArg, passwordArg] = process.argv;

  if (!emailArg) {
    console.error(
      "Usage: node --loader tsx scripts/create-admin.ts <email> [name] [password]"
    );
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const name = (nameArg ?? "Admin").trim();

  const driver = await db.getDb();
  if (!driver) {
    console.error(
      "DATABASE_URL is not configured — cannot connect to the database."
    );
    process.exit(1);
  }

  const existing = await db.getUserByEmail(email);

  if (existing) {
    await driver
      .update(users)
      .set({ role: "admin", plan: "enterprise" })
      .where(eq(users.id, existing.id));
    console.log(
      `[create-admin] Promoted ${email} (id=${existing.id}) to admin.`
    );
    return;
  }

  if (!passwordArg) {
    console.error(
      `[create-admin] No account found for ${email} and no password argument was provided. ` +
        "Refusing to create a passwordless account. Re-run with: create-admin <email> <name> <password>"
    );
    process.exit(1);
  }

  if (passwordArg.length < 8) {
    console.error("[create-admin] Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = hashPassword(passwordArg);
  const created = await db.createLocalUser({ email, name, passwordHash });
  await driver
    .update(users)
    .set({ role: "admin", plan: "enterprise" })
    .where(eq(users.id, created.id));

  console.log(
    `[create-admin] Created admin ${email} (id=${created.id}, plan=enterprise).`
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("[create-admin] Failed:", err);
    process.exit(1);
  });
