FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
COPY devpulse-dashboard-ui/package.json devpulse-dashboard-ui/package.json
RUN npm ci
COPY devpulse-dashboard-ui/ devpulse-dashboard-ui/
RUN npm run build --workspace devpulse-dashboard-ui

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/devpulse-dashboard-ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/devpulse-dashboard-ui/.next/static ./devpulse-dashboard-ui/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/devpulse-dashboard-ui/public ./devpulse-dashboard-ui/public
USER nextjs
EXPOSE 3000
CMD ["node", "devpulse-dashboard-ui/server.js"]
