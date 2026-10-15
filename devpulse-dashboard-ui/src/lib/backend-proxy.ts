const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Client IP taken ONLY from the header the configured hosting edge overwrites (CLIENT_IP_SOURCE):
 *  - "cloudflare": CF-Connecting-IP (set by Cloudflare's edge; X-Real-IP is stripped; XFF is appended to, so its
 *    left-most entry is client-controlled and is never used).
 *  - "vercel": X-Vercel-Forwarded-For / X-Real-IP (Vercel overwrites both and XFF; it does NOT strip
 *    CF-Connecting-IP, so that header is client-controlled on Vercel and is never used there).
 *  - unset/other: no client IP is signed (self-hosted/unknown edge: every forwarded header is spoofable).
 * The value must parse as a single IPv4/IPv6 literal. */
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
function isIpLiteral(v: string): boolean {
  if (IPV4.test(v)) return true;
  if (!/^[0-9a-fA-F:.]+$/.test(v) || !v.includes(':') || v.length > 45) return false;
  try { return new URL(`http://[${v}]/`).hostname.length > 2; } catch { return false; }
}
export function platformClientIp(request: Request, source = process.env.CLIENT_IP_SOURCE): string | null {
  let raw: string | null = null;
  if (source === 'cloudflare') raw = request.headers.get('cf-connecting-ip');
  else if (source === 'vercel') raw = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-real-ip');
  else return null;
  if (!raw) return null;
  const ip = raw.trim();
  return isIpLiteral(ip) ? ip : null;
}

export async function signedClientIpHeaders(request: Request): Promise<Record<string, string>> {
  const secret = process.env.PROXY_SIGNING_SECRET;
  const ip = platformClientIp(request);
  if (!secret || !ip) return {};
  const ts = Math.floor(Date.now() / 1000).toString();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ip}.${ts}`)));
  const sig = Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
  return { 'x-rakshex-client-ip': ip, 'x-rakshex-client-ts': ts, 'x-rakshex-client-sig': sig };
}

export async function proxyBackend(request: Request, path?: string) {
  const configured = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000');
  if (!configured) return Response.json({ error: 'Backend address is not configured' }, { status: 503 });
  const incoming = new URL(request.url);
  let origin: URL;
  try { origin = new URL(configured); } catch { return Response.json({ error: 'Invalid backend configuration' }, { status: 503 }); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      !['', '/'].includes(origin.pathname) || origin.search || origin.hash || origin.origin === incoming.origin) {
    return Response.json({ error: 'Invalid backend configuration' }, { status: 503 });
  }
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && process.env.ALLOW_HTTP_BACKEND !== 'true') {
    return Response.json({ error: 'Backend HTTPS is required' }, { status: 503 });
  }
  const headers = new Headers();
  for (const name of ['authorization', 'content-type', 'accept', 'stripe-signature', 'origin']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const [k, v] of Object.entries(await signedClientIpHeaders(request))) headers.set(k, v);
  let body: ArrayBuffer | undefined;
  if (request.body && !['GET', 'HEAD'].includes(request.method)) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return Response.json({ error: 'Request too large' }, { status: 413 }); }
      chunks.push(value);
    }
    const joined = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    body = joined.buffer;
  }
  try {
    const target = new URL(path || incoming.pathname, origin.origin);
    target.search = incoming.search;
    const response = await fetch(target, {
      method: request.method === 'HEAD' ? 'GET' : request.method,
      headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = response.headers.get(name); if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set('Cache-Control', 'no-store');
    // Stream exports rather than interpreting CSV as JSON or buffering whole reports.
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: 'Backend unavailable. Please retry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
