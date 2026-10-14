export const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'DEVPULSE_ENCRYPTION_KEY', 'FRONTEND_URL'];
const OPTIONAL = [
  'REDIS_URL', 'GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY', 'SENTRY_DSN', 'POSTHOG_API_KEY', 'POSTHOG_HOST',
  'STRIPE_PUBLISHABLE_KEY', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_ENT_MONTHLY', 'STRIPE_PRICE_ENT_YEARLY', 'GROQ_MODEL', 'XAI_MODEL',
  'OPENWEATHER_API_KEY', 'FROM_EMAIL', 'FROM_NAME', 'SENDGRID_FROM_EMAIL',
  'SLACK_WEBHOOK_URL', 'DISCORD_WEBHOOK_URL', 'JWT_EXPIRY_HOURS',
  'DB_POOL_MIN', 'DB_POOL_MAX', 'DB_POOL_RECYCLE',
  'RESOURCE_PROFILE', 'HEALTH_PROBE_INTERVAL_SECONDS', 'CHANGE_PROBE_INTERVAL_SECONDS',
  'HEALTH_WEBSOCKET_INTERVAL_SECONDS',
];

export async function resolveRuntimeConfig(env) {
  const values = await Promise.all([...REQUIRED, ...OPTIONAL].map(async name => {
    const binding = env[name];
    const value = typeof binding === 'string' ? binding : binding?.get ? await binding.get() : undefined;
    if (value !== undefined && typeof value !== 'string') throw new Error('Invalid secret binding');
    return [name, value];
  }));
  const config = Object.fromEntries(values.filter(([, value]) => value));
  if (REQUIRED.some(name => !config[name])) throw new Error('Missing runtime configuration');
  return {ENV: 'production', RESOURCE_PROFILE: 'free', ...config};
}
