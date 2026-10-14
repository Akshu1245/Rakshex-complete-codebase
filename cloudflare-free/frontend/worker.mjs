const API_PREFIXES = ['/api/', '/ws/'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/connection-info') {
      const socket = new URL('/ws/health', url.origin);
      socket.protocol = 'wss:';
      return Response.json({health_websocket_url: socket.href}, {headers: {'Cache-Control': 'no-store'}});
    }
    if (API_PREFIXES.some(prefix => url.pathname.startsWith(prefix)) ||
        ['/api', '/health', '/openapi.json', '/backend-docs'].includes(url.pathname)) {
      if (url.pathname === '/backend-docs') url.pathname = '/docs';
      try {
        // An in-account binding keeps internal routing private and preserves
        // request bodies, signed webhooks, authorization and WebSocket upgrades.
        const response = await env.BACKEND.fetch(new Request(url, request));
        if (response.status === 101) return response;
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'no-store');
        return new Response(response.body, {status: response.status, headers});
      } catch {
        return Response.json({error: 'Backend unavailable. Please retry.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
      }
    }
    return env.ASSETS.fetch(request);
  },
};
