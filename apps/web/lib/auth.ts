import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

/**
 * Strict in-app relative path: starts with "/" but not "//" (protocol-
 * relative), contains no backslashes (browser backslash-as-slash tricks),
 * and carries no scheme. Anything else is not a safe relative redirect.
 */
function isSafeRelativeRedirect(url: string): boolean {
  return (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.includes("\\") &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // next-auth default strength: absolute URLs must match the app origin
      // exactly (parsed-origin comparison — a string-prefix match lets
      // https://<origin>.evil.com and https://<origin>@evil.com through).
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // Not an absolute URL — fall through to the relative-path check.
      }
      if (isSafeRelativeRedirect(url)) return `${baseUrl}${url}`;
      return `${baseUrl}/dashboard`;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }
      return session;
    },
    async jwt({ token, account, profile: _profile }) {
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
