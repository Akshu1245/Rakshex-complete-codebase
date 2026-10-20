# Cloudflare deployment status — 2026-10-20

## Verified staging deployment

- Worker: `rakshex-impact-review-staging`
- URL: https://rakshex-impact-review-staging.rakshex.workers.dev/
- Code: `cloudflare-impact-review/worker.mjs`
- Configuration: `cloudflare-impact-review/wrangler.jsonc`
- Contains a privacy-conscious P1/P2 report viewer (file remains in browser), a synthetic example, `/api/health`, `/api/capabilities`, and strict no-index and no-frame headers.
- Does **not** execute ast-grep, accept customer source code, authenticate users, store reports, generate repair patches, or operate the full RaksHex platform.
- API/HTML/JS/CSS production smoke test passed in GitHub Actions. Browser smoke testing is managed separately in the workflow.
- The public staging deployment was created through the connected Cloudflare API, not GitHub workflow auto-deploy.

## Existing Cloudflare resources (preserved)

- Existing Workers include `rakshex-frontend`, `rakshex-free-backend` and `rakshex-devpulse-backend`; none was overwritten.
- Existing `rakshex-frontend` Worker binds assets and a backend service, but this does not establish that the latest Next.js UI from PR #251 is deployed there.
- Cloudflare zone `rakshex.in` is **pending** (nameservers not activated as of inspection).
- Public domain DNS in the pending zone still includes a Vercel-targeted `www`, Railway-targeted `api`, and mail MX/TXT records. Do not overwrite records during nameserver change.

## Production migration blockers

1. The existing full FastAPI backend uses async SQLAlchemy. Python Workers do not support the required `greenlet` dependency; the previous Containers deployment required Workers Paid and failed under the free-only policy. Existing Worker entries are not proof that the complete FastAPI product is live.
2. The Next.js 16 dashboard has not been built or published to the existing Cloudflare assets binding from the current integration branch. Cloudflare's newer recommendation is to evaluate `vinext` (currently beta); OpenNext is another supported path. Perform a compatibility build and full browser/API tests before switching.
3. P1/P2 scanner has not passed a real ast-grep full test run and is not ported to the canonical `engine/` workspace. The deployed staging browser viewer does not replace a local customer runner.
4. GitHub auth, workspace isolation, report ingestion contracts, persistence, privacy egress audit, and authorization must pass separate end-to-end tests.
5. `main` was not merged, DNS was not changed, and Vercel build hooks were not disabled.

## Next work

- Maintain P1/P2 PR #251 as draft against `integration/self-repair-engine`.
- Verify real browser smoke screenshots and complete backend / UI CI.
- Port P1/P2 scanner contract into `engine/` with pinned ast-grep tests and customer-controlled runner.
- Develop authenticated native Cloudflare API storage/coordination for sanitised metadata; do not expose raw code.
- Prove complete Next.js-to-Workers migration on a preview Worker and full feature parity before any public domain cutover.
- Only after verified service readiness, activate Cloudflare nameservers at the registrar and map the public domain, carefully preserving Lark mail and SPF/DKIM/DMARC records.
