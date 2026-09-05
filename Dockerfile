# Rakshex production multi-stage image (API + worker)
# Non-root user, healthcheck, graceful SIGTERM via Node server handlers.
FROM node:24-alpine AS base
RUN corepack enable pnpm
ENV HUSKY=0

# Full dependency graph is used only to validate/build the monorepo.
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY github-action/package.json ./github-action/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/github-action ./github-action
COPY . .
RUN pnpm run build

# Create a separate production-only dependency tree for the API and the
# workspace packages it actually depends on. This intentionally excludes web,
# test runners (Vitest/Playwright), Vite and other development tooling from the
# shipped API/worker image. The full builder above still validates all packages.
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY github-action/package.json ./github-action/package.json
RUN pnpm --filter @rakshex/api... install --prod --frozen-lockfile --ignore-scripts

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Pick up Alpine security patches before dropping privileges.
RUN apk upgrade --no-cache libcrypto3 libssl3 \
  && addgroup -g 1001 -S nodejs \
  && adduser -S -u 1001 -G nodejs -h /app -s /sbin/nologin nodejs

# Runtime uses node + the API's production tsx dependency only. Drop image-bundled
# npm to reduce attack surface; corepack remains available for Railway predeploys.
RUN corepack enable pnpm \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx || true

COPY --from=prod-deps --chown=nodejs:nodejs /app/package.json ./
COPY --from=prod-deps --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nodejs:nodejs /app/packages ./packages
COPY --from=prod-deps --chown=nodejs:nodejs /app/apps/api ./apps/api

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Use the package-local tsx binary. In a pnpm workspace, tsx is installed under
# apps/api/node_modules because @rakshex/api declares it as a production dependency.
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/_core/index.ts"]

FROM runner AS worker
ENV WORKER_CONCURRENCY=3
# Worker has no HTTP listener — clear inherited API healthcheck.
HEALTHCHECK NONE
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/queues/workers/index.ts"]

FROM runner AS api
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/_core/index.ts"]
