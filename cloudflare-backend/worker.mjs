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

export default {
  async fetch(request, env) {
    // Fail before provisioning a container if durable storage or secrets are absent.
    if (REQUIRED.some(name => !env[name])) {
      return Response.json({ error: 'BACKEND_NOT_CONFIGURED' }, { status: 503 });
    }
    try {
      // One instance preserves the existing process-local WebSocket coordination.
      return await getContainer(env.BACKEND, 'primary').fetch(request);
    } catch {
      return Response.json({ error: 'BACKEND_UNAVAILABLE' }, {
        status: 503, headers: { 'Retry-After': '10' },
      });
    }
  },
};
