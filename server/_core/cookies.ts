import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Determine if the request is cross-origin (frontend on a different domain
 * from the API). When the frontend is served from a different origin
 * (e.g. app.devpulse.in calling api.devpulse.in), we need sameSite="none"
 * so the browser sends the cookie cross-origin. For same-origin deployments
 * (frontend and API on the same host), "lax" is the safer default.
 */
function isCrossOriginRequest(req: Request): boolean {
  const origin = req.headers["origin"];
  if (!origin) return false;

  try {
    const originHost = new URL(origin).hostname;
    const reqHost = req.hostname;
    // Same host or subdomain pattern — not cross-origin
    if (originHost === reqHost) return false;
    if (originHost.endsWith("." + reqHost) || reqHost.endsWith("." + originHost)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const shouldSetDomain =
    hostname &&
    !LOCAL_HOSTS.has(hostname) &&
    !isIpAddress(hostname) &&
    hostname !== "127.0.0.1" &&
    hostname !== "::1";

  const domain =
    shouldSetDomain && !hostname.startsWith(".")
      ? `.${hostname}`
      : shouldSetDomain
        ? hostname
        : undefined;

  const isSecure = isSecureRequest(req);
  const isCrossOrigin = isCrossOriginRequest(req);

  // Use "none" only when the request is truly cross-origin AND over HTTPS.
  // For same-origin requests, "lax" is the safer default and still allows
  // top-level navigations (GET) from external links.
  const sameSite: "strict" | "lax" | "none" = isCrossOrigin && isSecure
    ? "none"
    : "lax";

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite,
    secure: isSecure,
  };
}
