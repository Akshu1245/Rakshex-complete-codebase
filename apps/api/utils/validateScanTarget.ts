/**
 * SSRF protection for user-supplied scan targets.
 *
 * DevPulse must never be tricked into making requests to internal/link-local
 * addresses (Redis, cloud metadata, private ranges). This validates a target
 * URL both by literal host and by DNS resolution before any fetch.
 */
import dns from "node:dns/promises";
import net from "node:net";

export interface ScanTargetValidation {
  ok: boolean;
  reason?: string;
  hostname?: string;
}

/** Block-list checks for a resolved/literal IPv4 or IPv6 address. */
export function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");

  // IPv6 loopback / unspecified / link-local / unique-local
  if (
    v === "::1" ||
    v === "::" ||
    v.startsWith("fe80:") ||
    v.startsWith("fc") ||
    v.startsWith("fd")
  ) {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) → extract the v4 tail
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const target = mapped ? mapped[1] : v;

  if (net.isIPv4(target)) {
    const [a, b] = target.split(".").map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }
  return false;
}

/**
 * Validate a scan target URL. Returns { ok:false, reason } if the URL is
 * malformed, non-http(s), points at a blocked literal IP, or resolves via DNS
 * to a blocked address.
 */
export async function validateScanTarget(rawUrl: string): Promise<ScanTargetValidation> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    return { ok: false, reason: "Internal hostnames are not allowed", hostname };
  }

  // Literal IP in the host
  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    return { ok: false, reason: "Target resolves to a blocked/internal address", hostname };
  }

  // DNS resolution guard — block hosts that resolve to internal ranges.
  if (!net.isIP(hostname)) {
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (records.length === 0) {
        return { ok: false, reason: "Host could not be resolved", hostname };
      }
      for (const r of records) {
        if (isBlockedIp(r.address)) {
          return { ok: false, reason: "Target resolves to a blocked/internal address", hostname };
        }
      }
    } catch {
      return { ok: false, reason: "Host could not be resolved", hostname };
    }
  }

  return { ok: true, hostname };
}
