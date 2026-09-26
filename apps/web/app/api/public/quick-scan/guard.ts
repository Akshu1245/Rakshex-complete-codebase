/* ---------------- URL validation (SSRF guard) ---------------- */

export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h === "::1") return true;
  if (/\.(local|localhost|internal|lan|home|corp|intranet)$/.test(h)) return true;
  // IPv4 literal checks
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b] = v4.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  // IPv6 literal checks (bracketed or bare)
  const bare = h.replace(/^\[|\]$/g, "");
  if (/^(::1|::ffff:127\.|fc|fd|fe80)/i.test(bare)) return true;
  return false;
}

export function validateTargetUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "URL is not valid." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs can be scanned." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are not scanned." };
  }
  if (isBlockedHost(url.hostname)) {
    return {
      ok: false,
      error: "That host is not eligible for scanning (private/internal address).",
    };
  }
  return { ok: true, url };
}
