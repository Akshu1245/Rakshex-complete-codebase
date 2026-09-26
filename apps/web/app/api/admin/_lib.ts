/**
 * Pure admin-gate helpers for the /api/admin routes. No server imports —
 * unit-tested in _lib.test.ts. The real security boundary is the route
 * handler (session check) plus the firewall worker's ADMIN_API_KEY.
 */

/** Parse a comma-separated ADMIN_EMAILS value into normalized emails. */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * True when the signed-in email belongs to an admin. Comparison is
 * case-insensitive; ADMIN_EMAILS may hold several comma-separated addresses
 * (e.g. the founder's personal Gmail and their @rakshex.in address).
 */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmailsRaw: string | undefined | null,
): boolean {
  if (!email) return false;
  return parseAdminEmails(adminEmailsRaw).includes(email.trim().toLowerCase());
}
