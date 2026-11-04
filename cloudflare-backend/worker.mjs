import { Container, getContainer } from '@cloudflare/containers';
import { REQUIRED, resolveRuntimeConfig } from './runtime-config.mjs';

export class DevPulseBackend extends Container {
  defaultPort = 8000;
  sleepAfter = '10m';

  async fetch(request) {
    this.envVars = await resolveRuntimeConfig(this.env);
    return super.fetch(request);
  }
}

// Do not expose the backend endpoint to search engines, even for edge 503s.
// Preserve WebSocket upgrade responses without attempting to reconstruct them.
function preventIndexing(response) {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    // Fail before provisioning a container if durable storage or secrets are absent.
    if (REQUIRED.some(name => !env[name])) {
      return preventIndexing(Response.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 }));
    }
    try {
      // One instance preserves the existing process-local WebSocket coordination.
      return preventIndexing(await getContainer(env.BACKEND, 'primary').fetch(request));
    } catch {
      return preventIndexing(Response.json({ error: 'BACKEND_UNAVAILABLE' }, {
        status: 503, headers: { 'Retry-After': '10' },
      }));
    }
  },
};
