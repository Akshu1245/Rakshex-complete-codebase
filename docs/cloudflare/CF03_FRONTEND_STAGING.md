# CF-03 — full RaksHex frontend, Cloudflare staging only

## What is actually implemented

- Existing Next.js 16 RaksHex frontend adapted for a **new** Worker `rakshex-web-opennext-staging` using OpenNext 1.20.10.
- Staging only: no production Worker replacement, no custom domain, no customer data migration.
- Full OpenNext build previously succeeded in PR #207, including 122 static pages and the NextAuth route. That does **not** mean OAuth worked at runtime. Cloudflare vinext checker flags next-auth v4 incompatible; OpenNext reported experimental Node middleware support.
- RaksHex backend still partly migrated: `rakshex-core-staging` supports only the new OpenAPI diff workflow and staging D1 jobs.
- The authoritative OAuth bridge and NextAuth routes return HTTP 503 in **Cloudflare builds** until backend app sessions, cookie security, CSRF, revocation and tenant isolation have real tests. Existing non-Cloudflare behavior is preserved.

## Reproducible staging build

Commit exact `@opennextjs/cloudflare` and `wrangler` versions and `pnpm-lock.yaml`. The pipeline `Cloudflare complete web staging` runs unit-level guards, OpenNext full build, Wrangler dry-run and a local Worker HTTP check.

From the repository root:

```bash
pnpm install --frozen-lockfile
node --test scripts/cloudflare/web-staging-routes.test.mjs
cd apps/web
node ../../scripts/cloudflare/patch-opennext-preview-props.mjs
RAKSHEX_DEPLOY_TARGET=cloudflare RAKSHEX_CLOUDFLARE_ENV=staging RAKSHEX_BACKEND_URL=https://rakshex-core-staging.rakshex.workers.dev pnpm exec opennextjs-cloudflare build
pnpm exec wrangler deploy --config wrangler.toml --dry-run
```

## Cloudflare connection blocker

Attempting to connect GitHub through the Builds API failed: `8000008` Git project disconnected. Cloudflare account currently has no build tokens/triggers. The owner must connect the **Cloudflare GitHub App** from Cloudflare dashboard → Workers & Pages → Worker → Settings → Builds → Connect → GitHub, and authorize `Akshu1245/Rakshex-complete-codebase`. This is separate from the existing ChatGPT GitHub connection.

Until the GitHub app is connected or a scoped deployment token is provided through an approved secret manager, **do not claim a full frontend Worker is deployed**. All successful tests represent staging build readiness only.

## Cutover gates

1. Deploy staging Worker on isolated `workers.dev` subdomain.
2. Verify homepage, assets, pages, redirects, headers and fail-closed 503 authentication routes.
3. Port authoritative backend auth and verify Google/GitHub OAuth, session cookies, logout/revocation, tenant RBAC and CSRF before enabling login.
4. Locate and restore the **real RaksHex PostgreSQL** source: currently linked Railway account belongs to DecisionTrace. Preserve signed Firewall evidence.
5. Migrate and verify remaining API, database, billing and workers; then rehearsed domain/DNS rollback.

## Next.js 16.4 / OpenNext 1.20.10 runtime workaround

The initial local Worker smoke test failed with `Unexpected loadManifest(/.next/server/preview-props.json)`. OpenNext 1.20.10 omits the mandatory Next.js 16.4 `preview-props.json` from its inlined manifest glob. Upstream fix [opennextjs/opennextjs-cloudflare#1356](https://github.com/opennextjs/opennextjs-cloudflare/pull/1356) is not yet merged. The staging build invokes `scripts/cloudflare/patch-opennext-preview-props.mjs` before OpenNext building. The script only edits the exact pinned installed 1.20.10 adapter, requires exactly one matching glob and fails closed if files or versions differ. This is a temporary build-time workaround, **not proof of passing SSR runtime until HTTP smoke is green**. Remove it when a fixed released adapter is verified.
