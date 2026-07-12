/** Routes accessible without authentication. Prefix matching for nested paths. */
export const PUBLIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/forgot-password",
  "/verify-email",
  "/mfa",
  // findings/collections require auth — not listed
  "/privacy",
  "/terms",
  "/cookies",
  "/pricing",
  "/waitlist",
  "/landing",
  "/benchmark",
  "/research",
  "/playbooks",
  "/api-docs",
  "/demo",
  "/blog",
  "/docs",
  "/compare",
  "/roi-calculator",
  "/features",
  "/about",
  "/faq",
  "/trust",
  "/changelog",
  "/integrations",
  "/partners",
  "/open-source",
  "/status",
  "/contact",
  "/enterprise",
  "/security",
  // "/audit-log", // NOT public — requires authentication
  "/solutions",
  "/billing/success",
  "/billing/failure",
] as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}
