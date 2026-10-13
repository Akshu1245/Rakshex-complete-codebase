'use client';

import { useEffect } from 'react';

/**
 * AnalyticsProvider – loads PostHog + Sentry on the client side.
 * Wrap your app or layout with this component.
 * Reads env vars: NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_SENTRY_DSN
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // PostHog
    const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (phKey) {
      import(/* webpackIgnore: true */ 'posthog-js' as string)
        .then((mod: { default: { init: (key: string, opts: Record<string, unknown>) => void } }) => {
          mod.default.init(phKey, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
          });
        })
        .catch(() => {
          // posthog-js not installed – skip silently
        });
    }

    // Sentry
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn) {
      import(/* webpackIgnore: true */ '@sentry/nextjs' as string)
        .then((Sentry: { init: (opts: Record<string, unknown>) => void }) => {
          Sentry.init({
            dsn: sentryDsn,
            tracesSampleRate: 0.2,
            environment: process.env.NODE_ENV,
          });
        })
        .catch(() => {
          // @sentry/nextjs not installed – skip silently
        });
    }
  }, []);

  return <>{children}</>;
}
