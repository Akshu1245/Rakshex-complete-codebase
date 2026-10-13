# DevPulse backend on Cloudflare

Prepared deployment, not live. Cloudflare returned `Unauthorized: You do not have access to Cloudflare Containers. Deploying containers requires the Workers Paid plan` on 13 October 2026.

This runs the original FastAPI backend in a Container rather than rewriting it into a partial Worker. The existing Cloudflare Workers and their databases are preserved.

## Deployment prerequisites

1. Enable Workers Paid on account `b3225f198c6d2286afbb6f416c230f10`.
2. Provision persistent PostgreSQL and apply `devpulse-backend/alembic` migrations. Container disk and the Durable Object SQLite database are not the application's PostgreSQL storage.
3. Install Docker and Node, then run `npm ci --workspaces=false` from this directory.
4. Configure Worker secrets using `npx wrangler secret put NAME`: `DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), `DEVPULSE_ENCRYPTION_KEY`, and `FRONTEND_URL` (the HTTPS frontend origin). Preserve signing/encryption keys across redeploys. Set provider credentials separately for enabled integrations.
5. Run `npm run check`, then `npm run deploy`. Wait for container provisioning and verify `/health`, registration/login, authenticated tenant APIs, and WebSockets at the returned URL.
6. Point the frontend `BACKEND_URL` at the backend and rebuild the frontend; browser CORS origin must match `FRONTEND_URL`.

The backend is limited to one container because existing WebSocket coordination, rate limiting, and optional memory caching are process-local. Background monitors stop when the container sleeps; continuously scheduled monitoring is not implemented by this configuration. Production launch checks reject missing secrets, temporary SQLite storage, and unavailable/unmigrated PostgreSQL. Full security review, migrations, integration credentials, and deployed end-to-end testing remain launch requirements.
