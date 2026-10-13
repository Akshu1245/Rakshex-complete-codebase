# Full RaksHex frontend on Cloudflare — 13 October 2026

## Deployed

- Live frontend: https://rakshex-frontend.rakshex.workers.dev/
- Worker: `rakshex-frontend`, version `0b26d578-1292-41b9-8eac-77f9dae586c0`, deployed at 100%.
- Full Next.js 16.4.0 application using OpenNext 1.20.10 and Wrangler 4.149.0, including 120 generated pages and static assets.
- Includes the runtime-demo cleanup from PR #222 and removal of the synthetic receipt on the Product page.
- `RAKSHEX_API` service binding forwards non-NextAuth API requests to `rakshex-api-staging`, preserving caller authorization, method, body and query without buffering responses.
- Prerendered data is stored in private `cdn-cgi/_next_cache` static assets. Cache interception serves immutable build output; changes require a fresh deployment. Dynamic application data remains API-driven.
- Existing Vercel deployment and custom-domain DNS were not changed. The connected Cloudflare account cannot access the `rakshex.in` zone.

## Verified live

| Request                                        | Expected and observed                                    |
| ---------------------------------------------- | -------------------------------------------------------- |
| `/`                                            | 200, RaksHex homepage                                    |
| `/overview`                                    | 200, no synthetic receipt/hash                           |
| `/docs`                                        | 200                                                      |
| `/api/health`                                  | 200, backend explicitly identifies partial staging state |
| `/api/auth/session`                            | 503 `APP_AUTH_NOT_MIGRATED`                              |
| `/dashboard` without credentials               | 307 to login                                             |
| `/api/v1/control/receipts` without credentials | 401 `UNAUTHORIZED`                                       |

Browser verification confirmed the homepage and Product navigation. Build/type checking passed; 11 Cloudflare routing/proxy regression cases passed. This is frontend hosting verification, not complete backend production parity.

## Rebuild and deploy

```bash
pnpm install --frozen-lockfile
node --test scripts/cloudflare/web-staging-routes.test.mjs scripts/cloudflare/backend-origin.test.mjs scripts/cloudflare/frontend-entry.test.mjs
node scripts/cloudflare/patch-opennext-preview-props.mjs
cd apps/web
RAKSHEX_DEPLOY_TARGET=cloudflare RAKSHEX_CLOUDFLARE_ENV=staging RAKSHEX_BACKEND_URL=https://rakshex-api-staging.rakshex.workers.dev NEXT_PUBLIC_TS_API_URL=https://rakshex-api-staging.rakshex.workers.dev NEXT_PUBLIC_SITE_URL=https://rakshex-frontend.rakshex.workers.dev NEXTAUTH_URL=https://rakshex-frontend.rakshex.workers.dev pnpm exec opennextjs-cloudflare build
pnpm exec opennextjs-cloudflare populateCache local
pnpm exec wrangler deploy --config wrangler.toml --dry-run --minify
pnpm exec wrangler deploy --config wrangler.toml --minify
```

Wrangler deployment requires an authenticated account or a scoped deployment token. The first deployment used the connected Cloudflare API, standard asset-upload sessions, and multipart Worker upload; temporary transfer storage and asset-session credentials were removed afterward. No persistent deployment token was created.

## Remaining boundaries

Cloudflare browser login, app sessions, approval consumption and provider execution are not completed by this deployment. NextAuth and the OAuth bridge remain disabled for Cloudflare until authoritative backend auth, CSRF, cookie security, revocation and tenant isolation are implemented and verified. Git-based automatic deployment is not configured. Custom-domain cutover requires access to the domain's authoritative DNS configuration.

The version-checked OpenNext manifest workaround remains necessary for the pinned adapter to include Next.js 16.4 `preview-props.json`; remove it after verifying a released upstream fix.
