const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Resolve a fixed upstream, not a user-supplied target. Public deployments
 * require HTTPS. A separately opted-in Docker Compose stack may use only the
 * internal service name `backend:8000`, never arbitrary HTTP/private IPs.
 */
export function resolveBackendOrigin(configured: string, incomingUrl: string, production: boolean, allowDockerHttp = false): URL | null {
  let origin: URL;
  try { origin = new URL(configured); } catch { return null; }
  const incoming = new URL(incomingUrl);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      !['', '/'].includes(origin.pathname) || origin.search || origin.hash ||
      origin.origin === incoming.origin) return null;
  if (production) {
    const host = origin.hostname.toLowerCase();
    const dockerInternal = allowDockerHttp && origin.protocol === 'http:' &&
      host === 'backend' && origin.port === '8000';
    if (origin.protocol !== 'https:' && !dockerInternal) return null;
    if (!dockerInternal &&
        (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
         host.startsWith('['))) return null;
    // Numeric IPs and local address ranges should not be production API backends.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  }
  return origin;
}

export async function proxyBackend(request: Request, path?: string) {
  const configured = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000');
  if (!configured) return Response.json({ error: 'Backend address is not configured' }, { status: 503 });
  const incoming = new URL(request.url);
  const origin = resolveBackendOrigin(
    configured, incoming.href, process.env.NODE_ENV === 'production',
    process.env.ALLOW_HTTP_BACKEND === 'true',
  );
  if (!origin) return Response.json({ error: 'Invalid or insecure backend configuration' }, { status: 503 });
  const headers = new Headers();
  for (const name of ['authorization', 'content-type', 'accept', 'stripe-signature', 'origin']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
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
