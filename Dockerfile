# Rakshex production multi-stage image (API + worker)
# Non-root user, healthcheck, graceful SIGTERM via Node server handlers.
FROM node:24-alpine AS base
RUN corepack enable pnpm
ENV HUSKY=0

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

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Pick up Alpine security patches before dropping privileges.
RUN apk upgrade --no-cache libcrypto3 libssl3 \
  && addgroup -g 1001 -S nodejs \
  && adduser -S -u 1001 -G nodejs -h /app -s /sbin/nologin nodejs

# Runtime uses node + tsx only — drop image-bundled npm to reduce runtime attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx || true

COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps ./apps
# Prefer monorepo package emit; keep drizzle migrations for runtime migrate jobs
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/drizzle ./packages/database/drizzle

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Use the package-local tsx binary. In a pnpm workspace, tsx is installed under
# apps/api/node_modules because @rakshex/api declares it directly; resolving the
# bare "tsx" package from /app is not reliable in the production image.
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/_core/index.ts"]

FROM runner AS worker
ENV WORKER_CONCURRENCY=3
# Worker has no HTTP listener — clear inherited API healthcheck.
HEALTHCHECK NONE
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/queues/workers/index.ts"]

FROM runner AS api
CMD ["./apps/api/node_modules/.bin/tsx", "apps/api/_core/index.ts"]
