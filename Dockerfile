FROM node:22-alpine AS base
RUN corepack enable pnpm
ENV HUSKY=0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY . .
# Foundation: typecheck/build packages; full API emit may still require path fixes
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/drizzle ./packages/database/drizzle
COPY --from=builder /app/packages/database/drizzle.config.ts ./packages/database/drizzle.config.ts
# Compat path for older tools expecting ./drizzle
COPY --from=builder /app/packages/database/drizzle ./drizzle

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# TODO(foundation): align emit path after apps/api tsc outDir is production-ready
CMD ["node", "dist/apps/api/_core/index.js"]

FROM runner AS worker
ENV WORKER_CONCURRENCY=3
CMD ["node", "dist/apps/api/queues/workers/index.js"]

FROM runner AS api
CMD ["node", "dist/apps/api/_core/index.js"]
