import { Container, getContainer } from '@cloudflare/containers';

export class DevPulseBackend extends Container {
  defaultPort = 8000;
  sleepAfter = '10m';

  constructor(ctx, env) {
    super(ctx, env);
    this.envVars = { ENV: 'production' };
    for (const name of [
      'DATABASE_URL', 'JWT_SECRET', 'DEVPULSE_ENCRYPTION_KEY', 'FRONTEND_URL',
      'REDIS_URL', 'GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
      'SENDGRID_API_KEY', 'SENTRY_DSN', 'POSTHOG_API_KEY',
    ]) {
      if (env[name]) this.envVars[name] = env[name];
    }
  }
}

export default {
  async fetch(request, env) {
    // Fail before provisioning a container if durable storage or secrets are absent.
    const required = ['DATABASE_URL', 'JWT_SECRET', 'DEVPULSE_ENCRYPTION_KEY', 'FRONTEND_URL'];
    if (required.some(name => !env[name])) {
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
