/**
 * Decodes a NextAuth.js v4 (JWT session strategy) session token, without
 * depending on the `next-auth` package itself.
 *
 * Why not just `import { decode } from "next-auth/jwt"`: that module's own
 * type declarations import from "next" and "next/server", which pulls
 * Next.js's global `NodeJS.ProcessEnv` augmentation (declaring `NODE_ENV`
 * `readonly`) into this plain Express codebase's type-checking — breaking
 * every test file that does `process.env.NODE_ENV = "..."`. This
 * reimplements the same algorithm NextAuth v4 actually uses (verified
 * against node_modules/next-auth/jwt/index.js at the time this was
 * written): a JWE encrypted with `alg: "dir", enc: "A256GCM"`, keyed by
 * an HKDF-derived key from NEXTAUTH_SECRET. If NextAuth ever changes this
 * algorithm, tokens will simply fail to decrypt (jwtDecrypt throws) rather
 * than silently misbehave.
 */
import { jwtDecrypt } from "jose";
import hkdf from "@panva/hkdf";

async function getDerivedEncryptionKey(secret: string, salt: string) {
  return hkdf(
    "sha256",
    secret,
    salt,
    `NextAuth.js Generated Encryption Key${salt ? ` (${salt})` : ""}`,
    32,
  );
}

export interface NextAuthTokenPayload {
  email?: string;
  name?: string;
  provider?: string;
  sub?: string;
  [key: string]: unknown;
}

export async function decodeNextAuthToken(
  token: string,
  secret: string,
  salt = "",
): Promise<NextAuthTokenPayload | null> {
  if (!token) return null;
  const key = await getDerivedEncryptionKey(secret, salt);
  const { payload } = await jwtDecrypt(token, key, { clockTolerance: 15 });
  return payload as NextAuthTokenPayload;
}
